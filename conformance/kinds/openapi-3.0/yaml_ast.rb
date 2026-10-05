# Syntax only: Psych's YAML 1.1 scalar resolver is deliberately never used.
require 'psych'
require 'json'
def tree(n)
  { 'node' => n.class.name.split('::').last, 'value' => (n.respond_to?(:value) ? n.value : nil),
    'tag' => (n.respond_to?(:tag) ? n.tag : nil), 'quoted' => (n.respond_to?(:quoted) ? n.quoted : nil),
    'anchor' => (n.respond_to?(:anchor) ? n.anchor : nil),
    'children' => (n.respond_to?(:children) && n.children ? n.children.map { |c| tree(c) } : []) }
end
puts JSON.generate(tree(Psych.parse_stream(STDIN.read)))
