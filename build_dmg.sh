#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FRONTEND_DIR="$DIR/athena-frontend"
BUILD_DIR="/tmp/exam-native-build"
STAGING_DIR="/tmp/exam-dmg-staging"
OUTPUT_DMG="$HOME/Desktop/ExamPortal.dmg"

echo "==> 1. Building React frontend..."
cd "$FRONTEND_DIR"
npm run build

echo "==> 2. Setting up build directories..."
rm -rf "$BUILD_DIR" "$STAGING_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$STAGING_DIR"

echo "==> 3. Compiling Universal (arm64 + x86_64) macOS binary..."
cat << 'OBJC_EOF' > "$BUILD_DIR/main.m"
#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

@interface SchemeHandler : NSObject <WKURLSchemeHandler>
@end

@implementation SchemeHandler
- (void)webView:(WKWebView *)webView startURLSchemeTask:(id<WKURLSchemeTask>)urlSchemeTask {
    NSURL *url = urlSchemeTask.request.URL;
    NSString *path = url.path;
    if (path.length == 0 || [path isEqualToString:@"/"]) {
        path = @"/index.html";
    }
    NSString *resourcePath = [[NSBundle mainBundle] resourcePath];
    NSString *distDir = [resourcePath stringByAppendingPathComponent:@"dist"];
    NSString *cleanPath = [path stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
    NSString *filePath = [distDir stringByAppendingPathComponent:cleanPath];
    NSData *data = [NSData dataWithContentsOfFile:filePath];
    if (!data) {
        NSError *error = [NSError errorWithDomain:@"SchemeHandler" code:404 userInfo:nil];
        [urlSchemeTask didFailWithError:error];
        return;
    }
    NSString *ext = [filePath pathExtension].lowercaseString;
    NSString *mimeType = @"application/octet-stream";
    if ([ext isEqualToString:@"html"]) mimeType = @"text/html; charset=utf-8";
    else if ([ext isEqualToString:@"js"] || [ext isEqualToString:@"mjs"]) mimeType = @"application/javascript; charset=utf-8";
    else if ([ext isEqualToString:@"css"]) mimeType = @"text/css; charset=utf-8";
    else if ([ext isEqualToString:@"svg"]) mimeType = @"image/svg+xml";
    else if ([ext isEqualToString:@"png"]) mimeType = @"image/png";
    else if ([ext isEqualToString:@"jpg"] || [ext isEqualToString:@"jpeg"]) mimeType = @"image/jpeg";
    else if ([ext isEqualToString:@"json"]) mimeType = @"application/json";
    NSDictionary *headers = @{
        @"Content-Type": mimeType,
        @"Access-Control-Allow-Origin": @"*"
    };
    NSHTTPURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:url statusCode:200 HTTPVersion:@"HTTP/1.1" headerFields:headers];
    [urlSchemeTask didReceiveResponse:response];
    [urlSchemeTask didReceiveData:data];
    [urlSchemeTask didFinish];
}
- (void)webView:(WKWebView *)webView stopURLSchemeTask:(id<WKURLSchemeTask>)urlSchemeTask {}
@end

@interface AppDelegate : NSObject <NSApplicationDelegate, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate>
@property (strong, nonatomic) NSWindow *window;
@property (strong, nonatomic) WKWebView *webView;
@property (strong, nonatomic) SchemeHandler *schemeHandler;
@end

@implementation AppDelegate
- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    NSRect frame = NSMakeRect(0, 0, 1050, 720);
    NSUInteger style = NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable;
    self.window = [[NSWindow alloc] initWithContentRect:frame styleMask:style backing:NSBackingStoreBuffered defer:NO];
    [self.window center];
    [self.window setTitle:@"Exam Portal"];
    
    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    self.schemeHandler = [[SchemeHandler alloc] init];
    [config setURLSchemeHandler:self.schemeHandler forURLScheme:@"app"];
    
    NSString *bridgeScript = @"window.electronAPI = {\n"
    "    setFullScreen: function(flag) {\n"
    "        try { window.webkit.messageHandlers.setFullScreen.postMessage(Boolean(flag)); } catch(e){}\n"
    "        return Promise.resolve(flag);\n"
    "    },\n"
    "    confirmSubmit: function() {\n"
    "        return new Promise(function(resolve) {\n"
    "            window._confirmSubmitCallback = resolve;\n"
    "            try { window.webkit.messageHandlers.confirmSubmit.postMessage({}); } catch(e){ resolve(true); }\n"
    "        });\n"
    "    }\n"
    "};";
    WKUserScript *userScript = [[WKUserScript alloc] initWithSource:bridgeScript injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:NO];
    [config.userContentController addUserScript:userScript];
    [config.userContentController addScriptMessageHandler:self name:@"setFullScreen"];
    [config.userContentController addScriptMessageHandler:self name:@"confirmSubmit"];
    config.mediaTypesRequiringUserActionForPlayback = WKAudiovisualMediaTypeNone;
    [config.preferences setValue:@YES forKey:@"developerExtrasEnabled"];
    
    self.webView = [[WKWebView alloc] initWithFrame:frame configuration:config];
    self.webView.UIDelegate = self;
    self.webView.navigationDelegate = self;
    self.webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    
    self.window.contentView = self.webView;
    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
    
    [self.webView loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"app://localhost/index.html"]]];
}

- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
    if ([message.name isEqualToString:@"setFullScreen"]) {
        BOOL isFull = (self.window.styleMask & NSWindowStyleMaskFullScreen) != 0;
        BOOL requested = [message.body boolValue];
        if (isFull != requested) {
            [self.window toggleFullScreen:nil];
        }
    } else if ([message.name isEqualToString:@"confirmSubmit"]) {
        NSAlert *alert = [[NSAlert alloc] init];
        [alert setMessageText:@"Submit Exam"];
        [alert setInformativeText:@"Are you sure you want to finish and submit the exam?"];
        [alert setAlertStyle:NSAlertStyleWarning];
        [alert addButtonWithTitle:@"Submit"];
        [alert addButtonWithTitle:@"Cancel"];
        NSModalResponse res = [alert runModal];
        BOOL confirmed = (res == NSAlertFirstButtonReturn);
        NSString *js = [NSString stringWithFormat:@"if (window._confirmSubmitCallback) { window._confirmSubmitCallback(%@); }", confirmed ? @"true" : @"false"];
        [self.webView evaluateJavaScript:js completionHandler:nil];
    }
}

- (void)webView:(WKWebView *)webView requestMediaCapturePermissionForOrigin:(WKSecurityOrigin *)origin initiatedByFrame:(WKFrameInfo *)frame type:(WKMediaCaptureType)type decisionHandler:(void (^)(WKPermissionDecision decision))decisionHandler API_AVAILABLE(macos(12.0)) {
    decisionHandler(WKPermissionDecisionGrant);
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}
@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        app.delegate = delegate;
        [app run];
    }
    return 0;
}
OBJC_EOF

clang -O2 -fobjc-arc -arch arm64 -arch x86_64 -framework Cocoa -framework WebKit "$BUILD_DIR/main.m" -o "$BUILD_DIR/ExamPortal"

echo "==> 4. Creating ExamPortal.app bundle..."
APP_BUNDLE="$STAGING_DIR/ExamPortal.app"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"
cp "$BUILD_DIR/ExamPortal" "$APP_BUNDLE/Contents/MacOS/ExamPortal"
chmod +x "$APP_BUNDLE/Contents/MacOS/ExamPortal"
cp -R "$FRONTEND_DIR/dist" "$APP_BUNDLE/Contents/Resources/dist"

cat << 'PLIST_EOF' > "$APP_BUNDLE/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>ExamPortal</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.exam.portal</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>ExamPortal</string>
    <key>CFBundleDisplayName</key>
    <string>Exam Portal</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSCameraUsageDescription</key>
    <string>Exam Portal requires camera access for identity verification and proctoring.</string>
    <key>NSMicrophoneUsageDescription</key>
    <string>Exam Portal requires microphone access for audio viva verification.</string>
</dict>
</plist>
PLIST_EOF

cat << 'ENT_EOF' > "$BUILD_DIR/entitlements.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.device.camera</key>
    <true/>
    <key>com.apple.security.device.microphone</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
ENT_EOF

if [ -f "$FRONTEND_DIR/node_modules/electron/dist/Electron.app/Contents/Resources/electron.icns" ]; then
  cp "$FRONTEND_DIR/node_modules/electron/dist/Electron.app/Contents/Resources/electron.icns" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
fi

xattr -cr "$APP_BUNDLE"
codesign --force --deep -s - --entitlements "$BUILD_DIR/entitlements.plist" "$APP_BUNDLE"
xattr -cr "$APP_BUNDLE"

echo "==> 5. Generating compressed HFS+ DMG..."
ln -s /Applications "$STAGING_DIR/Applications"
rm -f "$OUTPUT_DMG"
hdiutil create -volname "ExamPortal" -srcfolder "$STAGING_DIR" -ov -fs HFS+ -format UDZO "$OUTPUT_DMG"
xattr -cr "$OUTPUT_DMG"

echo "==> Success! DMG created at: $OUTPUT_DMG"
ls -lh "$OUTPUT_DMG"
