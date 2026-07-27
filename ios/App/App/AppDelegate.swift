import UIKit
import Capacitor
import CoreLocation
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, CLLocationManagerDelegate {

    var window: UIWindow?

    /// Must be retained — if deallocated before the system dialog appears,
    /// iOS silently never shows the Location permission prompt.
    private var permissionLocationManager: CLLocationManager?
    private var didBootstrapPermissions = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        bootstrapNativePermissionsIfNeeded()
    }

    /// Ask Notifications first, then Location — never in parallel.
    /// Simultaneous prompts cause iOS to suppress one or both dialogs.
    private func bootstrapNativePermissionsIfNeeded() {
        guard !didBootstrapPermissions else { return }
        didBootstrapPermissions = true

        // Window must be key/visible before system alerts.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
            self?.requestNotificationPermissionThenLocation()
        }
    }

    private func requestNotificationPermissionThenLocation() {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { [weak self] settings in
            DispatchQueue.main.async {
                guard let self else { return }

                switch settings.authorizationStatus {
                case .notDetermined:
                    center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
                        if granted {
                            DispatchQueue.main.async {
                                UIApplication.shared.registerForRemoteNotifications()
                            }
                        }
                        // Only after the user taps Allow/Don't Allow → ask location.
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                            self.requestLocationPermission()
                        }
                    }
                case .authorized, .provisional, .ephemeral:
                    UIApplication.shared.registerForRemoteNotifications()
                    self.requestLocationPermission()
                default:
                    self.requestLocationPermission()
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
        handleLocationAuthChange(manager)
    }

    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        handleLocationAuthChange(manager)
    }

    private func handleLocationAuthChange(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        guard status != .notDetermined else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            if self?.permissionLocationManager === manager {
                self?.permissionLocationManager = nil
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
