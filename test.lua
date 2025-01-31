local obj = {
    hello = "hi";
    bye = "hello";
    inner = {
        ok = "no";
        hi = function ()
            local v = obj.bye
            print(v);
        end
    }
}

function obj.inner.mean()
    print('THATS NOT NICE');
end

obj.inner.mean(); -- "THATS NOT NICE"
obj.inner.hi(); -- "hi"

print(obj.inner) -- {obj}
print(obj.inner.ok) -- "no"

getfenv(obj.inner.hi).obj.hello = 'bye';
print(getfenv(obj.inner.hi).obj.hello) -- "bye"