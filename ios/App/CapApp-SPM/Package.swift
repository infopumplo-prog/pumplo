// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.1.0"),
        .package(path: "../../../node_modules/@capacitor-community/apple-sign-in"),
        .package(path: "../../../node_modules/@capacitor/app"),
        .package(path: "../../../node_modules/@capacitor/browser"),
        .package(path: "../../../node_modules/@capacitor/filesystem"),
        .package(path: "../../../node_modules/@capacitor/geolocation"),
        .package(path: "../../../node_modules/@capacitor/share"),
        .package(path: "../../../node_modules/@capacitor/status-bar")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunityAppleSignIn", package: "apple-sign-in"),
                .product(name: "CapacitorApp", package: "app"),
                .product(name: "CapacitorBrowser", package: "browser"),
                .product(name: "CapacitorFilesystem", package: "filesystem"),
                .product(name: "CapacitorGeolocation", package: "geolocation"),
                .product(name: "CapacitorShare", package: "share"),
                .product(name: "CapacitorStatusBar", package: "status-bar")
            ]
        )
    ]
)
