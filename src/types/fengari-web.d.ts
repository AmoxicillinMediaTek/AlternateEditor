declare module "fengari-web" {
  type State = unknown;
  type CFunction = (state: State) => number;

  export const L: State;

  export const lua: {
    LUA_OK: number;
    LUA_VERSION_MAJOR: string;
    LUA_VERSION_MINOR: string;
    lua_gettop(state: State): number;
    lua_settop(state: State, index: number): void;
    lua_pop(state: State, count: number): void;
    lua_pushcfunction(state: State, fn: CFunction): void;
    lua_setglobal(state: State, name: Uint8Array): void;
    lua_insert(state: State, index: number): void;
    lua_pcall(state: State, args: number, results: number, errfunc: number): number;
    lua_tostring(state: State, index: number): Uint8Array | null;
  };

  export const lauxlib: {
    luaL_newstate(): State;
    luaL_tolstring(state: State, index: number): Uint8Array | null;
    luaL_loadbuffer(
      state: State,
      source: Uint8Array,
      size: number | null,
      name: Uint8Array,
    ): number;
  };

  export function to_luastring(value: string): Uint8Array;
  export function to_jsstring(value: Uint8Array): string;
}
