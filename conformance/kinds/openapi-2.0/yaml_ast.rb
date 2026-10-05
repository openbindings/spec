# Syntax tree only. Psych's YAML 1.1 scalar resolver is deliberately never used.
require 'psych'
require 'json'
def tree(node)
  h = {'kind' => node.class.name.split('::').last}
  [:value, :tag, :plain, :quoted, :anchor].each { |k| h[k.to_s] = node.send(k) if node.respond_to?(k) }
  h['children'] = node.children.map { |n| tree(n) } if node.respond_to?(:children) && node.children
  h
end
begin
  STDOUT.write(JSON.generate(tree(Psych.parse_stream(STDIN.read))))
rescue Exception => e
  STDERR.write(e.message)
  exit 1
end
