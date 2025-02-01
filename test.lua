function GetObj()
    local e = 'hi'
    local obj = {
        hello = "hi";
        bye = "hello";
        inner = {
            ok = "no";
            hi = function ()
                local v = e
                print(v);
            end
        }
    }
    return obj
end

local obj = GetObj();

function obj.inner.mean()
    print('THATS NOT NICE');
end

obj.inner.mean(); -- "THATS NOT NICE"
obj.inner.hi(); -- "hi"

print(obj.inner) -- {obj}
print(obj.inner.ok) -- "no"

getfenv(obj.inner.hi).e = 'hello, world';
print(getfenv(obj.inner.hi).e) -- "hello, world"
obj.inner.hi() -- "hello, world"