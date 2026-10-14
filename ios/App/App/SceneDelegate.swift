import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var syncTask: UIBackgroundTaskIdentifier = .invalid

    func sceneDidEnterBackground(_ scene: UIScene) {
        endSyncTask()
        let task = UIApplication.shared.beginBackgroundTask(withName: "LampaSync") { [weak self] in
            self?.endSyncTask()
        }
        syncTask = task
        DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in
            if self?.syncTask == task { self?.endSyncTask() }
        }
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        endSyncTask()
    }

    private func endSyncTask() {
        guard syncTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(syncTask)
        syncTask = .invalid
    }

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = LampaBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
