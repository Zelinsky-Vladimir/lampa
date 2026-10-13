import Capacitor
import NaturalLanguage
import SwiftUI
import Translation
import UIKit

@objc(AppleTranslatePlugin)
public class AppleTranslatePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleTranslatePlugin"
    public let jsName = "AppleTranslate"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "translate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise)
    ]

    private var queue: Task<Void, Never>?

    @objc func translate(_ call: CAPPluginCall) {
        guard #available(iOS 18.0, *) else {
            call.reject("NEEDS_IOS_18", "NEEDS_IOS_18")
            return
        }
        guard let text = call.getString("text"), !text.isEmpty, let to = call.getString("to"), !to.isEmpty else {
            call.reject("BAD_REQUEST", "BAD_REQUEST")
            return
        }
        DispatchQueue.main.async {
            let previous = self.queue
            self.queue = Task { @MainActor in
                await previous?.value
                await self.run(call, text: text, to: to)
            }
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        guard #available(iOS 18.0, *) else {
            call.reject("NEEDS_IOS_18", "NEEDS_IOS_18")
            return
        }
        guard let to = call.getString("to"), !to.isEmpty else {
            call.reject("BAD_REQUEST", "BAD_REQUEST")
            return
        }
        let target = Locale.Language(identifier: Self.appleCode(to))
        let source = Self.source(code: call.getString("from"), text: call.getString("text"))
        Task {
            let status = await Self.availability(from: source, to: target)
            call.resolve(["status": status, "src": source?.languageCode?.identifier ?? ""])
        }
    }

    @objc func prepare(_ call: CAPPluginCall) {
        guard #available(iOS 18.0, *) else {
            call.reject("NEEDS_IOS_18", "NEEDS_IOS_18")
            return
        }
        guard let from = call.getString("from"), !from.isEmpty, let to = call.getString("to"), !to.isEmpty else {
            call.reject("BAD_REQUEST", "BAD_REQUEST")
            return
        }
        let source = Locale.Language(identifier: Self.appleCode(from))
        let target = Locale.Language(identifier: Self.appleCode(to))
        DispatchQueue.main.async {
            let previous = self.queue
            self.queue = Task { @MainActor in
                await previous?.value
                guard let parent = self.bridge?.viewController else {
                    call.reject("TRANSLATE_FAILED", "TRANSLATE_FAILED")
                    return
                }
                if await Self.availability(from: source, to: target) == "supported" {
                    _ = try? await TranslationHost.run(.init(source: source, target: target), in: parent) { session in
                        try await session.prepareTranslation()
                    }
                }
                call.resolve(["status": await Self.availability(from: source, to: target)])
            }
        }
    }

    @available(iOS 18.0, *)
    private static func availability(from source: Locale.Language?, to target: Locale.Language) async -> String {
        guard let source else { return "unknown" }
        if source.languageCode == target.languageCode { return "installed" }
        switch await LanguageAvailability().status(from: source, to: target) {
        case .installed: return "installed"
        case .supported: return "supported"
        default: return "unsupported"
        }
    }

    @available(iOS 18.0, *)
    private static func source(code: String?, text: String?) -> Locale.Language? {
        if let code, !code.isEmpty { return Locale.Language(identifier: appleCode(code)) }
        guard let text, !text.isEmpty else { return nil }
        return NLLanguageRecognizer.dominantLanguage(for: text).map { Locale.Language(identifier: $0.rawValue) }
    }

    @available(iOS 18.0, *)
    @MainActor
    private func run(_ call: CAPPluginCall, text: String, to: String) async {
        let target = Locale.Language(identifier: Self.appleCode(to))
        let source = NLLanguageRecognizer.dominantLanguage(for: text).map { Locale.Language(identifier: $0.rawValue) }
        let src = source?.languageCode?.identifier ?? ""

        if let source, source.languageCode == target.languageCode {
            call.resolve(["text": text, "src": src])
            return
        }
        if let source, await LanguageAvailability().status(from: source, to: target) == .unsupported {
            call.reject("UNSUPPORTED_LANG", "UNSUPPORTED_LANG")
            return
        }
        guard let parent = bridge?.viewController else {
            call.reject("TRANSLATE_FAILED", "TRANSLATE_FAILED")
            return
        }
        do {
            let response = try await TranslationHost.run(.init(source: source, target: target), in: parent) { session in
                try await session.translate(text)
            }
            call.resolve(["text": response.targetText, "src": response.sourceLanguage.languageCode?.identifier ?? src])
        } catch TranslationError.unsupportedSourceLanguage, TranslationError.unsupportedTargetLanguage, TranslationError.unsupportedLanguagePairing {
            call.reject("UNSUPPORTED_LANG", "UNSUPPORTED_LANG")
        } catch {
            CAPLog.print("[AppleTranslate] \(error)")
            if await Self.availability(from: source, to: target) == "supported" {
                call.reject("NOT_DOWNLOADED", "NOT_DOWNLOADED")
            } else {
                call.reject("TRANSLATE_FAILED", "TRANSLATE_FAILED")
            }
        }
    }

    private static func appleCode(_ code: String) -> String {
        switch code {
        case "zh-CN": return "zh-Hans"
        case "zh-TW": return "zh-Hant"
        default: return code
        }
    }
}

@available(iOS 18.0, *)
@MainActor
private enum TranslationHost {
    static func run<T>(_ configuration: TranslationSession.Configuration, in parent: UIViewController, _ work: @escaping (TranslationSession) async throws -> T) async throws -> T {
        try await withCheckedThrowingContinuation { continuation in
            let controller = UIHostingController<TranslationTaskView?>(rootView: nil)
            controller.rootView = TranslationTaskView(configuration: configuration) { session in
                let result: Result<T, Error>
                do {
                    result = .success(try await work(session))
                } catch {
                    result = .failure(error)
                }
                DispatchQueue.main.async {
                    controller.willMove(toParent: nil)
                    controller.view.removeFromSuperview()
                    controller.removeFromParent()
                    continuation.resume(with: result)
                }
            }
            controller.view.frame = CGRect(x: 0, y: 0, width: 1, height: 1)
            controller.view.backgroundColor = .clear
            controller.view.isUserInteractionEnabled = false
            parent.addChild(controller)
            parent.view.addSubview(controller.view)
            controller.didMove(toParent: parent)
        }
    }
}

@available(iOS 18.0, *)
private struct TranslationTaskView: View {
    let configuration: TranslationSession.Configuration
    let action: (TranslationSession) async -> Void

    var body: some View {
        Color.clear
            .translationTask(configuration) { session in
                await action(session)
            }
    }
}
