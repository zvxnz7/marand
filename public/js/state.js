export const state = {
    socket: null,
  
    currentView: "magazyn",
    showTrash: false,
    showArchived: false,
  
    searchQ: "",
    statusMode: "all",
  
    notes: new Map(),
    editingId: null,
    zCounter: 0,
  
    unread: 0,
  
    cam: { x: 20, y: 20, z: 1.0 },
  
    isDraggingNote: false,
    panning: false,
    panStart: { x: 0, y: 0, camX: 0, camY: 0 },
  
    pointers: new Map(),
    pinch: { active:false, id1:null, id2:null, d0:0, z0:1 },
  };
  