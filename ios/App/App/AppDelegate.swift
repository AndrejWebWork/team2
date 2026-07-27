import UIKit
import Capacitor
import CoreLocation
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, CLLocationManagerDelegate {

    var window: UIWindow?

    /// Must be retained — if the manager is deallocated before the system dialog
    /// appears, iOS silently never shows Location (or Notifications) permission.
    private var permissionLocationManager: CLLocationManager?
    private var didBootstrapPermissions = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Warm up notification center early so the first request is reliable.
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        bootstrapNativePermissionsIfNeeded()
    }

    /// Ask for Location + Notifications from native code on the main thread.
    /// Capacitor JS bridges sometimes miss the dialog on Sideloadly / first launch.
    private func bootstrapNativePermissionsIfNeeded() {
        guard !didBootstrapPermissions else { return }
        didBootstrapPermissions = true

        // Slight delay so the window is key and UI is visible (required for prompts).
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            self?.requestNotificationPermission()
            self?.requestLocationPermission()
        }
    }

    private func requestNotificationPermission() {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            guard settings.authorizationStatus == .notDetermined else {
                if settings.authorizationStatus == .authorized
                    || settings.authorizationStatus == .provisional
                    || settings.authorizationStatus == .ephemeral {
                    DispatchQueue.main.async {
                        UIApplication.shared.registerForRemoteNotifications()
                    }
                }
                return
            }
            DispatchQueue.main.async {
                center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
                    if granted {
                        DispatchQueue.main.async {
                            UIApplication.shared.registerForRemoteNotifications()
                        }
                    }
                }
            }
        }
    }

    private func requestLocationPermission() {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard CLLocationManager.locationServicesEnabled() else { return }

            let manager = CLLocationManager()
            manager.delegate = self
            // Retain until the user answers — otherwise the dialog never appears.
            self.permissionLocationManager = manager

            let status = manager.authorizationStatus
            guard status == .notDetermined else {
                self.permissionLocationManager = nil
                return
            }
            manager.requestWhenInUseAuthorization()
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        if status != .notDetermined {
            // Keep manager briefly; release after dialog is done.
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                if self?.permissionLocationManager === manager {
                    self?.permissionLocationManager = nil
                }
            }
        }
    }

    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        // iOS 13 and earlier
        if status != .notDetermined {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                if self?.permissionLocationManager === manager {
                    self?.permissionLocationManager = nil
                }
            }
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

}

extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }
}
