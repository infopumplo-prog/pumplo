import Foundation

// Přepočet svislého tahu na kroky hodnoty. Bez SwiftUI (tedy Double místo
// CGFloat), aby to šlo přeložit harnessem v ios/App/NativeTests.
//
// Na hodinkách roste translation.height směrem DOLŮ, proto obrácené znaménko:
// tah nahoru = kladné kroky = přidat.
enum DragStepper {
    static let pointsPerStep: Double = 8

    static func totalSteps(translationHeight: Double) -> Int {
        Int((-translationHeight / pointsPerStep).rounded(.towardZero))
    }
}
