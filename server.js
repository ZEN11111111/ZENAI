const express=require("express");
const app=express();
const PORT=process.env.PORT||10000;
app.use(express.json({limit:"2mb"}));
app.use(express.static(__dirname));
app.get("/api/health",(_req,res)=>res.json({ok:true}));
app.post("/api/chat",async(req,res)=>{
 try{
  const messages=Array.isArray(req.body.messages)?req.body.messages:[];
  if(!messages.length)return res.status(400).json({error:"メッセージがありません。"});
  const key=process.env.OPENAI_API_KEY;
  if(!key)return res.json({text:"ZENAIはサーバーに接続できています。Renderの環境変数に OPENAI_API_KEY を設定するとAI回答が有効になります。"});
  const input=messages.map(m=>({role:m.role==="assistant"?"assistant":"user",content:[{type:"input_text",text:String(m.content)}]}));
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5-mini",instructions:"あなたはZENAIという日本語AIアシスタントです。親しみやすく、分かりやすく回答してください。",input})});
  const d=await r.json();if(!r.ok)return res.status(r.status).json({error:d?.error?.message||"OpenAI APIエラー"});
  res.json({text:d.output_text||"回答を取得できませんでした。"});
 }catch(e){console.error(e);res.status(500).json({error:e.message})}
});
app.listen(PORT,"0.0.0.0",()=>console.log(`ZENAI listening on port ${PORT}`));