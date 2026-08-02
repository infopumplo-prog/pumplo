#!/usr/bin/env ruby
# App target používá klasické skupiny (synchronizovanou složku má jen
# PumploWidgets), takže .swift soubor v ios/App/App se sám nepřeloží — musí
# být zapsaný v project.pbxproj. Skript je idempotentní, dá se pustit vícekrát.
require 'xcodeproj'

FILES = %w[WatchWorkoutPlugin.swift WatchPayload.swift].freeze

project_path = File.expand_path('../App.xcodeproj', __dir__)
project = Xcodeproj::Project.open(project_path)

target = project.targets.find { |t| t.name == 'App' } or abort 'App target not found'
group = project.main_group.find_subpath('App', false) or abort 'App group not found'

FILES.each do |name|
  if target.source_build_phase.files.any? { |f| f.file_ref&.path == name }
    puts "skip  #{name} (already in target)"
    next
  end
  reference = group.files.find { |f| f.path == name } || group.new_reference(name)
  target.add_file_references([reference])
  puts "added #{name}"
end

project.save
puts 'saved App.xcodeproj'
