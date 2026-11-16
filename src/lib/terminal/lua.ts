import type * as FengariWeb from "fengari-web";

type Runtime = typeof FengariWeb;

let runtime: Promise<Runtime> | null = null;

async function loadRuntime(): Promise<Runtime> {
  runtime ??= import("fengari-web");
  return runtime;
}

export interface LuaResult {
  output: string[];
  error: string | null;
}

export async function luaVersion(): Promise<string> {
  const { lua } = await loadRuntime();
  return `Lua ${lua.LUA_VERSION_MAJOR}.${lua.LUA_VERSION_MINOR} via Fengari`;
}

export async function runLua(source: string, chunkName: string): Promise<LuaResult> {
  const { L, lua, lauxlib, to_luastring, to_jsstring } = await loadRuntime();
  const output: string[] = [];

  const stringAt = (index: number): string => {
    const pointer = lauxlib.luaL_tolstring(L, index);
    const text = pointer ? to_jsstring(pointer) : "";
    lua.lua_pop(L, 1);
    return text;
  };

  const print = (state: unknown): number => {
    const top = lua.lua_gettop(state);
    const parts: string[] = [];
    for (let index = 1; index <= top; index += 1) parts.push(stringAt(index));
    output.push(parts.join("\t"));
    return 0;
  };

  lua.lua_pushcfunction(L, print);
  lua.lua_setglobal(L, to_luastring("print"));

  const status = lauxlib.luaL_loadbuffer(
    L,
    to_luastring(source),
    null,
    to_luastring(`@${chunkName}`),
  );
  if (status !== lua.LUA_OK) {
    const raw = lua.lua_tostring(L, -1);
    const message = raw === null ? "Lua syntax error" : to_jsstring(raw);
    lua.lua_pop(L, 1);
    return { output, error: message };
  }

  const handler = (state: unknown): number => {
    const message = lauxlib.luaL_tolstring(state, 1);
    return message ? 1 : 0;
  };

  lua.lua_pushcfunction(L, handler);
  const base = lua.lua_gettop(L) - 1;
  lua.lua_insert(L, base);
  const result = lua.lua_pcall(L, 0, 0, base);
  if (result !== lua.LUA_OK) {
    const message = lua.lua_tostring(L, -1);
    const text = message === null ? "Lua runtime error" : to_jsstring(message);
    lua.lua_pop(L, 2);
    return { output, error: text };
  }
  lua.lua_pop(L, 1);
  return { output, error: null };
}
