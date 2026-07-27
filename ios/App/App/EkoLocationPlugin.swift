import Foundation
import Capacitor
import CoreLocation

/// Plain CoreLocation GPS for iOS — bypasses flaky @capacitor/geolocation (ION) layer.
@objc(EkoLocationPlugin)
public class EkoLocationPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "EkoLocationPlugin"
    public let jsName = "EkoLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getCurrentPosition", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
    ]

    private var manager: CLLocationManager?
    private var positionCall: CAPPluginCall?
    private var permissionCall: CAPPluginCall?
    private var timeoutWork: DispatchWorkItem?
    private var bestLocation: CLLocation?
    private var isUpdating = false

    public override func load() {
        let m = CLLocationManager()
        m.delegate = self
        manager = m
    }

    private func servicesEnabled() -> Bool {
        CLLocationManager.locationServicesEnabled()
    }

    private func authStatus() -> CLAuthorizationStatus {
        manager?.authorizationStatus ?? .notDetermined
    }

    private func permissionString(_ status: CLAuthorizationStatus) -> String {
        switch status {
        case .authorizedAlways, .authorizedWhenInUse:
            return "granted"
        case .denied, .restricted:
            return "denied"
        default:
            return "prompt"
        }
    }

    @objc public override func checkPermissions(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.servicesEnabled() else {
                call.reject("Location services are not enabled.", "services_off")
                return
            }
            let s = self.permissionString(self.authStatus())
            call.resolve(["location": s, "coarseLocation": s])
        }
    }

    @objc public override func requestPermissions(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.servicesEnabled() else {
                call.reject("Location services are not enabled.", "services_off")
                return
            }
            let status = self.authStatus()
            if status == .notDetermined {
                self.permissionCall = call
                self.bridge?.saveCall(call)
                self.manager?.requestWhenInUseAuthorization()
                return
            }
            let s = self.permissionString(status)
            call.resolve(["location": s, "coarseLocation": s])
        }
    }

    @objc func getCurrentPosition(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.servicesEnabled() else {
                call.reject("Location services are not enabled.", "services_off")
                return
            }

            let status = self.authStatus()
            if status == .denied || status == .restricted {
                call.reject("Location permission denied.", "denied")
                return
            }

            if status == .notDetermined {
                self.positionCall = call
                self.bridge?.saveCall(call)
                self.manager?.requestWhenInUseAuthorization()
                return
            }

            self.beginLocationRequest(call)
        }
    }

    private func beginLocationRequest(_ call: CAPPluginCall) {
        timeoutWork?.cancel()
        if let prev = positionCall, prev.callbackId != call.callbackId {
            prev.reject("Cancelled by a newer location request.", "cancelled")
            bridge?.releaseCall(prev)
        }

        positionCall = call
        bridge?.saveCall(call)
        bestLocation = nil

        let enableHighAccuracy = call.getBool("enableHighAccuracy") ?? false
        let timeoutMs = max(call.getInt("timeout") ?? 30000, 5000)
        let maximumAge = call.getInt("maximumAge") ?? 0

        if maximumAge > 0, let last = manager?.location, last.horizontalAccuracy >= 0 {
            let ageMs = Int(Date().timeIntervalSince(last.timestamp) * 1000)
            if ageMs >= 0 && ageMs <= maximumAge {
                finishSuccess(call, location: last)
                return
            }
        }

        guard let manager else {
            call.reject("Location manager unavailable.", "unavailable")
            return
        }

        manager.desiredAccuracy = enableHighAccuracy
            ? kCLLocationAccuracyBest
            : kCLLocationAccuracyHundredMeters
        manager.distanceFilter = kCLDistanceFilterNone

        if !isUpdating {
            isUpdating = true
            manager.startUpdatingLocation()
        }

        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            self.stopUpdates()
            if let best = self.bestLocation {
                self.finishSuccess(call, location: best)
            } else if let last = self.manager?.location, last.horizontalAccuracy >= 0 {
                self.finishSuccess(call, location: last)
            } else {
                self.finishError(call, message: "Could not obtain location in time.", code: "timeout")
            }
        }
        timeoutWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(timeoutMs), execute: work)
    }

    private func stopUpdates() {
        if isUpdating {
            manager?.stopUpdatingLocation()
            isUpdating = false
        }
    }

    private func finishSuccess(_ call: CAPPluginCall, location: CLLocation) {
        timeoutWork?.cancel()
        timeoutWork = nil
        stopUpdates()
        var coords: [String: Any] = [
            "latitude": location.coordinate.latitude,
            "longitude": location.coordinate.longitude,
            "accuracy": location.horizontalAccuracy,
            "altitude": location.altitude,
            "altitudeAccuracy": location.verticalAccuracy,
        ]
        if location.speed >= 0 {
            coords["speed"] = location.speed
        }
        if location.course >= 0 {
            coords["heading"] = location.course
        }
        call.resolve([
            "coords": coords,
            "timestamp": location.timestamp.timeIntervalSince1970 * 1000,
        ])
        bridge?.releaseCall(call)
        if positionCall?.callbackId == call.callbackId {
            positionCall = nil
        }
    }

    private func finishError(_ call: CAPPluginCall, message: String, code: String) {
        timeoutWork?.cancel()
        timeoutWork = nil
        stopUpdates()
        call.reject(message, code)
        bridge?.releaseCall(call)
        if positionCall?.callbackId == call.callbackId {
            positionCall = nil
        }
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus

        if let pCall = permissionCall {
            let s = permissionString(status)
            pCall.resolve(["location": s, "coarseLocation": s])
            bridge?.releaseCall(pCall)
            permissionCall = nil
        }

        guard let call = positionCall else { return }
        if status == .authorizedWhenInUse || status == .authorizedAlways {
            beginLocationRequest(call)
        } else if status == .denied || status == .restricted {
            finishError(call, message: "Location permission denied.", code: "denied")
        }
    }

    public func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        locationManagerDidChangeAuthorization(manager)
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last, loc.horizontalAccuracy >= 0 else { return }

        if bestLocation == nil || loc.horizontalAccuracy <= (bestLocation?.horizontalAccuracy ?? .greatestFiniteMagnitude) {
            bestLocation = loc
        }

        // Accept a usable fix early (≤150m) — indoors Wi‑Fi/cell is enough for reports.
        if loc.horizontalAccuracy > 0 && loc.horizontalAccuracy <= 150, let call = positionCall {
            finishSuccess(call, location: loc)
        }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let clErr = error as? CLError, clErr.code == .denied, let call = positionCall {
            finishError(call, message: "Location permission denied.", code: "denied")
        }
        // Other errors: keep waiting until timeout (GPS often recovers).
    }
}
