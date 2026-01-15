// chat_ui.js (compat layer for existing socket_handlers imports)

import { dom } from "./dom.js";
import { state } from "./state.js";
import { esc } from "./utils.js";

const NAME_KEY = "noteo_chat_name_v1";

let unread = 0;
let baseTitle = document.title || "Noteo";

function isChatOpen(){
  return dom.chatPanel && dom.chatPanel.style.display === "block";
}

function applyBadgeUI(){
  // badge
  if (dom.chatBadge){
    if (unread > 0){
      dom.chatBadge.style.display = "inline-block";
      dom.chatBadge.textContent = String(unread);
    } else {
      dom.chatBadge.style.display = "none";
      dom.chatBadge.textContent = "0";
    }
  }

  // loud button glow
  if (dom.chatBtn){
    dom.chatBtn.classList.toggle("chatHot", unread > 0);
  }

  // title counter
  document.title = unread > 0 ? `(${unread}) ${baseTitle}` : baseTitle;
}

/** ✅ This is what your socket_handlers.js is importing */
export function setChatBadge(n){
  unread = Math.max(0, Number(n || 0));
  applyBadgeUI();
}

export function resetChatUnread(){
  setChatBadge(0);
}

/** ✅ Backwards-compatible: socket_handlers can call addChatMsg directly */
export function addChatMsg(m){
  if (!dom.chatMsgs) return;

  const name = esc((m && m.name) ? m.name : "Anon");
  const text = esc((m && m.text) ? m.text : "");
  const ts = (m && m.ts) ? new Date(m.ts).toLocaleTimeString() : "";

  const div = document.createElement("div");
  div.style.marginBottom = "8px";
  div.innerHTML = `<span style="opacity:.7;font-size:12px;">${ts}</span> <b>${name}:</b> ${text}`;
  dom.chatMsgs.appendChild(div);
}

export function scrollChatToBottom(){
  if (!dom.chatMsgs) return;
  dom.chatMsgs.scrollTop = dom.chatMsgs.scrollHeight;
}

/** ✅ Convenience: call when a message arrives and you want a visible notification */
export function notifyNewMessage(){
  setChatBadge(unread + 1);
}

function loadName(){
  try{
    const saved = localStorage.getItem(NAME_KEY);
    if (saved && dom.chatName) dom.chatName.value = saved;
  } catch {}
}

function saveName(){
  if (!dom.chatName) return;
  try{
    localStorage.setItem(NAME_KEY, (dom.chatName.value || "").trim());
  } catch {}
}

function sendChat(){
  const text = (dom.chatText?.value || "").trim();
  if (!text) return;

  saveName();

  state.socket.emit("chat:send", {
    name: (dom.chatName?.value || "").trim(),
    text
  });

  dom.chatText.value = "";
  dom.chatText.focus();
}

/** ✅ Call once during app init */
export function bindChatUI(){
  // persist name
  loadName();
  if (dom.chatName){
    dom.chatName.addEventListener("input", saveName);
    dom.chatName.addEventListener("blur", saveName);
  }

  // open/close
  if (dom.chatBtn){
    dom.chatBtn.onclick = () => {
      const open = isChatOpen();
      dom.chatPanel.style.display = open ? "none" : "block";

      if (!open){
        // opening chat clears unread
        resetChatUnread();
        setTimeout(() => dom.chatText?.focus(), 0);
      }
    };
  }

  if (dom.chatCloseBtn){
    dom.chatCloseBtn.onclick = () => {
      dom.chatPanel.style.display = "none";
    };
  }

  // send
  if (dom.chatSendBtn) dom.chatSendBtn.onclick = sendChat;
  if (dom.chatText){
    dom.chatText.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendChat();
    });
  }

  // if user comes back to tab and chat is open, clear unread
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && isChatOpen()){
      resetChatUnread();
    }
  });

  // init UI
  setChatBadge(0);
}
