local DEFAULT_NAME = "User";

local name = io.read("What's your name?");

print(name)
print(nil)
print(name == "" or name == nil)

if name == "" or name == nil then
	print("No name provided, defaulting to " .. DEFAULT_NAME .. ".");
	name = DEFAULT_NAME;
end

print("Hello, " .. name .. "!");