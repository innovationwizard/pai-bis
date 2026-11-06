export type Target =
  | { kind: "total" }
  | { kind: "project"; projectId: string }
  | { kind: "advisor"; projectId: string; advisorId: string };

export type State = {
  focusProjectId: string | null;
  selected: string[];
  hover: Target | null;
  kbd: Target | null;
  drawerAdvisorId: string | null;
  origen: boolean;
  metaOn: boolean;
  metaValue: number;
  view: "sunburst" | "treemap" | "flujo";
  shortcuts: boolean;
};

export type Action =
  | { type: "zoom-project"; projectId: string }
  | { type: "toggle-project"; projectId: string }
  | { type: "zoom-out" }
  | { type: "hover"; target: Target | null }
  | { type: "kbd"; target: Target | null }
  | { type: "open-drawer"; advisorId: string }
  | { type: "close-drawer" }
  | { type: "set-origen"; open: boolean }
  | { type: "set-meta-on"; on: boolean }
  | { type: "set-meta-value"; value: number }
  | { type: "set-view"; view: State["view"] }
  | { type: "toggle-shortcuts" }
  | { type: "reset" }
  | { type: "escape" };

export function initialState(): State {
  return {
    focusProjectId: null,
    selected: [],
    hover: null,
    kbd: null,
    drawerAdvisorId: null,
    origen: false,
    metaOn: false,
    metaValue: 4,
    view: "sunburst",
    shortcuts: false,
  };
}

export function spotlightOf(state: State): Target | null {
  return state.hover ?? state.kbd;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "zoom-project":
      return {
        ...state,
        focusProjectId: action.projectId,
        selected: [action.projectId],
        drawerAdvisorId: null,
      };
    case "toggle-project": {
      const selected = state.selected.includes(action.projectId)
        ? state.selected.filter((id) => id !== action.projectId)
        : [...state.selected, action.projectId];
      const focusProjectId =
        state.focusProjectId != null && selected.length === 1 && selected[0] === state.focusProjectId
          ? state.focusProjectId
          : null;
      return { ...state, selected, focusProjectId, drawerAdvisorId: null };
    }
    case "zoom-out":
      return { ...state, focusProjectId: null, selected: [], drawerAdvisorId: null };
    case "hover":
      return state.hover === action.target ? state : { ...state, hover: action.target };
    case "kbd":
      return { ...state, kbd: action.target };
    case "open-drawer":
      return { ...state, drawerAdvisorId: action.advisorId };
    case "close-drawer":
      return { ...state, drawerAdvisorId: null };
    case "set-origen":
      return { ...state, origen: action.open };
    case "set-meta-on":
      return { ...state, metaOn: action.on };
    case "set-meta-value":
      return { ...state, metaValue: Math.min(10, Math.max(0, Math.round(action.value))) };
    case "set-view":
      return { ...state, view: action.view };
    case "toggle-shortcuts":
      return { ...state, shortcuts: !state.shortcuts };
    case "reset":
      return initialState();
    case "escape":
      if (state.shortcuts) return { ...state, shortcuts: false };
      if (state.origen) return { ...state, origen: false };
      if (state.drawerAdvisorId) return { ...state, drawerAdvisorId: null };
      if (state.focusProjectId || state.selected.length > 0) {
        return { ...state, focusProjectId: null, selected: [] };
      }
      return state;
    default:
      return state;
  }
}
