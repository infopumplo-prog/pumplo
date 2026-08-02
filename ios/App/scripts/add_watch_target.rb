#!/usr/bin/env ruby
# Zakládá watchOS app target, který průvodce v Xcode 26.3 vytvořit nedokáže —
# spadne na NSInvalidArgumentException v Xcode3ProjectTemplateFactory (viz
# ~/Vaults/pumplo/provoz/watch-target-xcode-crash.md). Skript nastaví přesně to,
# co by nastavil průvodce: SDK, minimum, cílení na hodinky, identifikátor,
# propojení s telefonní appkou a zabalení hodinek do iOS produktu.
#
# Idempotentní — druhé spuštění existující target nechá být.
require 'xcodeproj'

TARGET_NAME = 'PumploWatch Watch App'.freeze
FOLDER = 'PumploWatch Watch App'.freeze
APP_BUNDLE_ID = 'com.pumplo.app'.freeze
WATCH_BUNDLE_ID = 'com.pumplo.app.watchkitapp'.freeze
TEAM = 'DF748BR59G'.freeze

project_path = File.expand_path('../App.xcodeproj', __dir__)
project = Xcodeproj::Project.open(project_path)

app_target = project.targets.find { |t| t.name == 'App' } or abort 'App target not found'

watch_target = project.targets.find { |t| t.name == TARGET_NAME }
if watch_target
  puts "Target '#{TARGET_NAME}' už existuje — jen srovnám nastavení."
else
  watch_target = project.new_target(:application, TARGET_NAME, :watchos, '10.0')
  puts "Vytvořen target '#{TARGET_NAME}'."
end

# Build settings. GENERATE_INFOPLIST_FILE + INFOPLIST_KEY_* je moderní varianta
# bez ručně psaného Info.plist, stejně jako u targetů z Xcode 16+.
watch_target.build_configurations.each do |config|
  s = config.build_settings
  s['SDKROOT'] = 'watchos'
  s['WATCHOS_DEPLOYMENT_TARGET'] = '10.0'
  s['TARGETED_DEVICE_FAMILY'] = '4'
  s['PRODUCT_BUNDLE_IDENTIFIER'] = WATCH_BUNDLE_ID
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['DEVELOPMENT_TEAM'] = TEAM
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['SWIFT_VERSION'] = '5.0'
  s['GENERATE_INFOPLIST_FILE'] = 'YES'
  s['CURRENT_PROJECT_VERSION'] = '1'
  s['MARKETING_VERSION'] = '1.0'
  s['SKIP_INSTALL'] = 'YES'
  s['ENABLE_PREVIEWS'] = 'YES'
  s['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
  s['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = 'AccentColor'
  # Tohle dělá z targetu hodinkovou appku spárovanou s telefonní — bez toho by
  # ji watchOS bral jako samostatnou a nikdy by se nenainstalovala s Pumplem.
  s['INFOPLIST_KEY_WKCompanionAppBundleIdentifier'] = APP_BUNDLE_ID
  s['INFOPLIST_KEY_WKApplication'] = 'YES'
  s['INFOPLIST_KEY_CFBundleDisplayName'] = 'Pumplo'
  s['INFOPLIST_KEY_UISupportedInterfaceOrientations'] =
    'UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown'
end

# Zdrojové soubory. App target používá klasické skupiny (synchronizovanou složku
# má jen PumploWidgets), držíme se stejného přístupu i tady.
group = project.main_group.find_subpath(FOLDER, true)
group.set_source_tree('SOURCE_ROOT')
group.set_path(FOLDER)

sources_dir = File.expand_path("../#{FOLDER}", __dir__)
swift_files = Dir.glob("#{sources_dir}/*.swift").sort
abort "Ve složce #{FOLDER} nejsou žádné .swift soubory" if swift_files.empty?

swift_files.each do |path|
  name = File.basename(path)
  ref = group.files.find { |f| f.display_name == name } || group.new_reference(name)
  unless watch_target.source_build_phase.files_references.include?(ref)
    watch_target.add_file_references([ref])
    puts "  + #{name}"
  end
end

assets = File.join(sources_dir, 'Assets.xcassets')
if File.exist?(assets)
  ref = group.files.find { |f| f.display_name == 'Assets.xcassets' } || group.new_reference('Assets.xcassets')
  unless watch_target.resources_build_phase.files_references.include?(ref)
    watch_target.resources_build_phase.add_file_reference(ref)
    puts '  + Assets.xcassets'
  end
end

# Zabalení hodinek dovnitř telefonní appky. Destination 16 = Products Directory,
# podcesta Watch — přesně tam, kde ji iOS při instalaci hledá.
embed = app_target.build_phases.find do |phase|
  phase.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) && phase.name == 'Embed Watch Content'
end
unless embed
  embed = app_target.new_copy_files_build_phase('Embed Watch Content')
  embed.dst_subfolder_spec = '16'
  embed.dst_path = '$(CONTENTS_FOLDER_PATH)/Watch'
  puts 'Přidána fáze Embed Watch Content.'
end
unless embed.files_references.include?(watch_target.product_reference)
  build_file = embed.add_file_reference(watch_target.product_reference)
  build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  puts '  + PumploWatch do Embed Watch Content'
end

# Aby se hodinky přeložily dřív, než je iOS produkt zabalí.
app_target.add_dependency(watch_target) unless app_target.dependencies.any? { |d| d.target == watch_target }

project.save
puts "Hotovo: #{project_path}"
