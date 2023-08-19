local DEFAULT_NAME = "User";

local name = io.read("What's your name?");

if name == "" then
	print("No name provided, defaulting to " .. DEFAULT_NAME .. ".");
	name = DEFAULT_NAME;
end

print("Hello, " .. name .. "!");