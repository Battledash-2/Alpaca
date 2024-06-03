-- !! FIX !!

local function ask(question, type)
    local q = question .. " - "

    if type == "bool" then q = q .. "Y/N" end -- These don't work the first time!
    if type == "str" then q = q .. "String" end
    if type == "num" then q = q .. "Number" end

    return io.read(q)
end

local age = ask("How old are you?", "num")
local name = ask("What is your name?", "str")
local debt = ask("Are you in debt?", "bool")

print(name .. " is " .. age .. " years old and is " .. (debt == "Y" and "in debt." or "not in debt."))