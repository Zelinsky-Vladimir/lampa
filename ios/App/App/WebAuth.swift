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

@objc(DictionaryPlugin)
public class DictionaryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DictionaryPlugin"
    public let jsName = "Dictionary"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise)
    ]

    @objc func show(_ call: CAPPluginCall) {
        let term = call.getString("term") ?? ""
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController, !term.isEmpty else {
                call.reject("NO_TERM")
                return
            }
            guard UIReferenceLibraryViewController.dictionaryHasDefinition(forTerm: term) else {
                call.resolve(["shown": false])
                return
            }
            let sheet = UIReferenceLibraryViewController(term: term)
            sheet.modalPresentationStyle = .pageSheet
            host.present(sheet, animated: true)
            call.resolve(["shown": true])
        }
    }
}

@objc(FolderPickerPlugin)
public class FolderPickerPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "FolderPickerPlugin"
    public let jsName = "FolderPicker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pick", returnType: CAPPluginReturnPromise)
    ]
    private static let exts: Set<String> = ["fb2", "epub", "txt", "zip", "pdf", "mobi", "azw", "azw3", "djvu", "rtf", "doc", "docx"]
    private var pending: CAPPluginCall?

    @objc func pick(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController else {
                call.reject("NO_VIEW")
                return
            }
            self.pending = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
            picker.delegate = self
            host.present(picker, animated: true)
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pending?.resolve(["files": []])
        pending = nil
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pending, let dir = urls.first else { return }
        pending = nil
        DispatchQueue.global(qos: .userInitiated).async {
            let scoped = dir.startAccessingSecurityScopedResource()
            defer { if scoped { dir.stopAccessingSecurityScopedResource() } }
            let fm = FileManager.default
            let tmp = fm.temporaryDirectory.appendingPathComponent("lampa-import-\(UUID().uuidString)")
            var files: [String] = []
            if let walker = fm.enumerator(at: dir, includingPropertiesForKeys: [.isRegularFileKey], options: [.skipsHiddenFiles, .skipsPackageDescendants]) {
                for case let url as URL in walker {
                    if files.count >= 2000 { break }
                    guard FolderPickerPlugin.exts.contains(url.pathExtension.lowercased()) else { continue }
                    let slot = tmp.appendingPathComponent(String(files.count))
                    let dest = slot.appendingPathComponent(url.lastPathComponent)
                    do {
                        try fm.createDirectory(at: slot, withIntermediateDirectories: true)
                        try fm.copyItem(at: url, to: dest)
                        files.append(dest.absoluteString)
                    } catch {
                        continue
                    }
                }
            }
            call.resolve(["name": dir.lastPathComponent, "files": files])
        }
    }
}

@objc(PageSnapPlugin)
public class PageSnapPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PageSnapPlugin"
    public let jsName = "PageSnap"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "capture", returnType: CAPPluginReturnPromise)
    ]

    @objc func capture(_ call: CAPPluginCall) {
        let x = call.getDouble("x") ?? 0
        let y = call.getDouble("y") ?? 0
        let w = call.getDouble("width") ?? 0
        let h = call.getDouble("height") ?? 0
        DispatchQueue.main.async {
            guard let web = self.bridge?.webView, w > 0, h > 0 else {
                call.resolve(["data": ""])
                return
            }
            let config = WKSnapshotConfiguration()
            config.rect = CGRect(x: x, y: y, width: w, height: h)
            config.afterScreenUpdates = false
            web.takeSnapshot(with: config) { image, _ in
                guard let image = image else {
                    call.resolve(["data": ""])
                    return
                }
                DispatchQueue.global(qos: .userInitiated).async {
                    let data = image.jpegData(compressionQuality: 0.9)?.base64EncodedString() ?? ""
                    call.resolve(["data": data])
                }
            }
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
        bridge?.registerPluginInstance(DictionaryPlugin())
        bridge?.registerPluginInstance(FolderPickerPlugin())
        bridge?.registerPluginInstance(PageSnapPlugin())
    }
}
