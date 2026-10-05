require 'psych'
require 'json'
# Syntax only: never use Psych's YAML 1.1 scalar resolver or object constructor.
def node(n)
  case n
  when Psych::Nodes::Stream, Psych::Nodes::Document
    {kind: n.class.name.split('::').last, children: n.children.map { |c| node(c) }}
  when Psych::Nodes::Scalar
    {kind: 'Scalar', value: n.value, plain: n.plain, tag: n.tag}
  when Psych::Nodes::Mapping, Psych::Nodes::Sequence
    {kind: n.class.name.split('::').last, tag: n.tag, children: n.children.map { |c| node(c) }}
  else
    {kind: 'Unsupported', name: n.class.name}
  end
end
begin
  puts JSON.generate(node(Psych.parse_stream(STDIN.read)))
rescue Psych::SyntaxError => e
  STDERR.puts e.message
  exit 2
end
