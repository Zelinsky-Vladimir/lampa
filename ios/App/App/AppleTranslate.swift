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
        CAPPluginMethod(name: "translate", returnType: CAPPluginReturnPromise)
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
            let response = try await TranslationHost.translate(text, from: source, to: target, in: parent)
            call.resolve(["text": response.targetText, "src": response.sourceLanguage.languageCode?.identifier ?? src])
        } catch TranslationError.unsupportedSourceLanguage, TranslationError.unsupportedTargetLanguage, TranslationError.unsupportedLanguagePairing {
            call.reject("UNSUPPORTED_LANG", "UNSUPPORTED_LANG")
        } catch {
            CAPLog.print("[AppleTranslate] \(error)")
            call.reject("TRANSLATE_FAILED", "TRANSLATE_FAILED")
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
    static func translate(_ text: String, from source: Locale.Language?, to target: Locale.Language, in parent: UIViewController) async throws -> TranslationSession.Response {
        try await withCheckedThrowingContinuation { continuation in
            let controller = UIHostingController<TranslationTaskView?>(rootView: nil)
            controller.rootView = TranslationTaskView(configuration: .init(source: source, target: target), text: text) { result in
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
    let text: String
    let done: (Result<TranslationSession.Response, Error>) -> Void

    var body: some View {
        Color.clear
            .translationTask(configuration) { session in
                do {
                    done(.success(try await session.translate(text)))
                } catch {
                    done(.failure(error))
                }
            }
    }
}
