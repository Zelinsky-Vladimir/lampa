import AuthenticationServices
import Capacitor
import UIKit
import WebKit

@objc(WebAuthPlugin)
public class WebAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "WebAuthPlugin"
    public let jsName = "WebAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise)
    ]

    private var session: ASWebAuthenticationSession?

    @objc func start(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw),
              let scheme = call.getString("scheme"), !scheme.isEmpty else {
            call.reject("url and scheme are required")
            return
        }
        DispatchQueue.main.async {
            let done: ASWebAuthenticationSession.CompletionHandler = { [weak self] callbackURL, error in
                self?.session = nil
                if let callbackURL {
                    call.resolve(["url": callbackURL.absoluteString])
                } else if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    call.resolve([:])
                } else {
                    call.reject(error?.localizedDescription ?? "Sign-in failed")
                }
            }
            let session: ASWebAuthenticationSession
            if #available(iOS 17.4, *) {
                session = ASWebAuthenticationSession(url: url, callback: .customScheme(scheme), completionHandler: done)
            } else {
                session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme, completionHandler: done)
            }
            session.presentationContextProvider = self
            self.session = session
            if !session.start() {
                self.session = nil
                call.reject("Sign-in could not start")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        bridge?.webView?.window ?? ASPresentationAnchor()
    }
}

class LampaWebView: WKWebView {
    static var hideEditMenu = false

    override func buildMenu(with builder: UIMenuBuilder) {
        super.buildMenu(with: builder)
        if Self.hideEditMenu {
            let menus: [UIMenu.Identifier] = [.standardEdit, .lookup, .share, .replace, .format, .learn, .find, .spelling, .speech, .textStyle, .writingDirection, .substitutions, .transformations]
            menus.forEach { builder.remove(menu: $0) }
            return
        }
        builder.replaceChildren(ofMenu: .lookup) { children in
            children.filter { !Self.isSystemTranslate($0) }
        }
    }

    private static func isSystemTranslate(_ element: UIMenuElement) -> Bool {
        if let command = element as? UICommand {
            return NSStringFromSelector(command.action).lowercased().contains("translate")
        }
        if let action = element as? UIAction {
            return action.identifier.rawValue.lowercased().contains("translate")
        }
        return false
    }
}

@objc(ReaderMenuPlugin)
public class ReaderMenuPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ReaderMenuPlugin"
    public let jsName = "ReaderMenu"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)
    ]

    @objc func set(_ call: CAPPluginCall) {
        let off = call.getBool("off") ?? false
        DispatchQueue.main.async {
            if LampaWebView.hideEditMenu != off {
                LampaWebView.hideEditMenu = off
                UIMenuSystem.context.setNeedsRebuild()
            }
            call.resolve()
        }
    }
}

class LampaBridgeViewController: CAPBridgeViewController {
    override open func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        LampaWebView(frame: frame, configuration: configuration)
    }

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WebAuthPlugin())
        bridge?.registerPluginInstance(AppleSignInPlugin())
        bridge?.registerPluginInstance(AppleTranslatePlugin())
        bridge?.registerPluginInstance(ReaderMenuPlugin())
    }
}
