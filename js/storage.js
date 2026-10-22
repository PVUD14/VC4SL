// storage.js - tiny wrapper around localStorage. Every call is wrapped in try/catch
// because browsers can block storage (private mode, strict settings).

// [1] All saved items share this prefix so we never collide with other sites' data.
const PREFIX = "vc4sl.";

// [2] Read one saved value. Returns the fallback if nothing is saved or storage is blocked.
export function load(name, fallback = "") {
  try {
    const value = localStorage.getItem(PREFIX + name);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

// [3] Save one value. Returns true on success, false if the browser refused.
export function save(name, value) {
  try {
    localStorage.setItem(PREFIX + name, value);
    return true;
  } catch {
    return false;
  }
}

// [4] Delete one saved value.
export function remove(name) {
  try {
    localStorage.removeItem(PREFIX + name);
  } catch {
    // Nothing to do: if storage is blocked there is nothing stored to remove.
  }
}
