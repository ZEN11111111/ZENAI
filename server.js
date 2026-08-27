function live(i){
  const m = cur.messages[i];

  const live = document.getElementById("live");
  const summary = document.getElementById("summary");
  const label = document.getElementById("thinkLabel");

  if(live){
    live.textContent = m.content || "";
  }

  if(m.thought){
    if(label){
      label.textContent = "考えています…";
    }

    if(summary && prefs.showThoughts){
      summary.textContent = m.thought;
      summary.classList.add("show");
    }
  }

  if(m.content){
    if(label){
      label.textContent = "回答を生成中…";
    }
  }

  $("messages").scrollTop =
    $("messages").scrollHeight;
}
