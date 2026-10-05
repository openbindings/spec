# Psych is used only as a YAML syntax parser. Its YAML 1.1 value resolution is
# deliberately not used. The Python probe applies candidate Core resolution.
require 'psych'
require 'json'
def node(n)
  case n
  when Psych::Nodes::Scalar
    { 'kind' => 'scalar', 'value' => n.value, 'tag' => n.tag, 'plain' => n.plain }
  when Psych::Nodes::Alias
    { 'kind' => 'alias', 'anchor' => n.anchor }
  else
    { 'kind' => n.class.name.split('::').last.downcase,
      'tag' => (n.respond_to?(:tag) ? n.tag : nil),
      'anchor' => (n.respond_to?(:anchor) ? n.anchor : nil),
      'children' => n.children.map { |c| node(c) } }
  end
end
puts JSON.generate(node(Psych.parse_stream(STDIN.read)))
