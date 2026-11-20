import { createCn } from "cn/config"

/* Eigene Schriftgrößen (Design-Tokens) bekannt machen, damit z. B. „text-title text-snow“
   nicht als zwei Textfarben gelten und die Größe verloren geht. */
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["caption", "body", "headline", "title", "large", "display"] }] } },
})
