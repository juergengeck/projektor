const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  BorderStyle, AlignmentType, ShadingType, ImageRun, LevelFormat, PageOrientation
} = require('docx');

const INK='2C3445', MUTED='667289', ACCENT='70809E', SOFT='EEF2F7', LINE='D7DDE8';
const FONT='Arial';
const CONTENT=10318, C3=[3440,3439,3439];
const NONE={style:BorderStyle.NONE,size:0,color:'FFFFFF'};
const noBorders={top:NONE,bottom:NONE,left:NONE,right:NONE,insideHorizontal:NONE,insideVertical:NONE};

const ent=s=>s.replace(/&mdash;/g,'—').replace(/&rsquo;/g,'’')
              .replace(/&ldquo;/g,'“').replace(/&rdquo;/g,'”');

// split "<b>bold</b> plain" into runs
function rt(str,{size=18,color=MUTED,bold=false}={}){
  return ent(str).split(/(<b>.*?<\/b>)/g).filter(Boolean).map(part=>{
    const m=part.match(/^<b>(.*)<\/b>$/s);
    return new TextRun({text:m?m[1]:part, bold:bold||!!m, color:m?INK:color, size, font:FONT});
  });
}
const P=(str,o={})=>new Paragraph({children:rt(str,o),spacing:{after:o.after??0,line:o.line??280},...(o.p||{})});
const bullet=str=>new Paragraph({children:rt(str,{size:18}),numbering:{reference:'b',level:0},spacing:{after:100,line:280}});
const accentRule=()=>new Paragraph({spacing:{after:60},border:{bottom:{style:BorderStyle.SINGLE,size:8,color:ACCENT}},children:[new TextRun({text:'',size:2})]});
const cell=(children,width)=>new TableCell({children,width:{size:width,type:WidthType.DXA},margins:{top:0,bottom:0,left:0,right:170},borders:noBorders});
const table=(rows,widths,extra={})=>new Table({rows,columnWidths:widths,width:{size:widths.reduce((a,b)=>a+b,0),type:WidthType.DXA},borders:noBorders,...extra});

function build(t){
  const logo=new ImageRun({type:'png',data:fs.readFileSync('logo.png'),transformation:{width:36,height:36}});

  const header=table([new TableRow({children:[
    cell([new Paragraph({children:[logo]})],760),
    cell([
      new Paragraph({spacing:{after:0},children:[
        new TextRun({text:'projektor',bold:true,size:30,color:INK,font:FONT}),
        new TextRun({text:'.one',size:30,color:ACCENT,font:FONT})]}),
      P(t.tagline,{size:15,after:0})],5000),
    cell([
      new Paragraph({alignment:AlignmentType.RIGHT,spacing:{after:40},children:[
        new TextRun({text:t.eyebrow.toUpperCase(),bold:true,size:15,color:ACCENT,font:FONT,characterSpacing:12})]}),
      new Paragraph({alignment:AlignmentType.RIGHT,children:rt(t.eyebrow2,{size:15})})],4158)
  ]})],[760,5000,4558]);

  const cols=table([new TableRow({children:t.cols.map((c,i)=>cell(
    [accentRule(),P(c.h,{size:20,color:INK,bold:true,after:120}),...c.li.map(bullet)],C3[i]))})],C3);

  const steps=table([new TableRow({children:t.steps.map((s,i)=>cell([
    new Paragraph({spacing:{after:60},children:[
      new TextRun({text:(i+1)+'  ',bold:true,size:18,color:ACCENT,font:FONT}),
      new TextRun({text:ent(s.h),bold:true,size:18,color:INK,font:FONT})]}),
    P(s.p,{size:17,after:0})],C3[i]))})],C3);

  const strip=new Table({
    rows:[new TableRow({children:[
      new TableCell({children:[P(t.stripLabel,{size:19,color:INK,bold:true,after:0})],
        width:{size:2900,type:WidthType.DXA},shading:{type:ShadingType.CLEAR,fill:SOFT,color:'auto'},
        margins:{top:160,bottom:160,left:200,right:200},
        borders:{top:NONE,bottom:NONE,right:NONE,left:{style:BorderStyle.SINGLE,size:18,color:ACCENT}}}),
      new TableCell({children:[P(t.stripText,{size:18,after:0})],
        width:{size:7418,type:WidthType.DXA},shading:{type:ShadingType.CLEAR,fill:SOFT,color:'auto'},
        margins:{top:160,bottom:160,left:0,right:200},borders:noBorders})]})],
    columnWidths:[2900,7418],width:{size:CONTENT,type:WidthType.DXA}});

  const foot=table([new TableRow({children:[
    cell([P(t.residency,{size:17,after:0})],7100),
    cell([new Paragraph({alignment:AlignmentType.RIGHT,spacing:{after:20},children:[
        new TextRun({text:'projektor.one',bold:true,size:17,color:INK,font:FONT})]}),
      new Paragraph({alignment:AlignmentType.RIGHT,children:rt(t.mark,{size:15})})],3218)
  ]})],[7100,3218]);

  return new Document({
    numbering:{config:[{reference:'b',levels:[{level:0,format:LevelFormat.BULLET,text:'•',
      alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:200,hanging:160}},run:{color:LINE,size:18}}}]}]},
    sections:[{
      properties:{page:{size:{orientation:PageOrientation.PORTRAIT},
        margin:{top:640,bottom:640,left:794,right:794}}},
      children:[
        new Paragraph({spacing:{after:200},border:{bottom:{style:BorderStyle.SINGLE,size:24,color:ACCENT}},children:[new TextRun({text:'',size:2})]}),
        header,
        new Paragraph({spacing:{before:260,after:120},children:[
          new TextRun({text:ent(t.h1),bold:true,size:62,color:INK,font:FONT})]}),
        P(t.sub,{size:22,color:INK,after:140,line:320}),
        new Paragraph({spacing:{after:160},children:[
          new TextRun({text:t.strap.toUpperCase(),bold:true,size:15,color:ACCENT,font:FONT,characterSpacing:24})]}),
        new Paragraph({spacing:{after:200},border:{bottom:{style:BorderStyle.SINGLE,size:6,color:LINE}},children:[new TextRun({text:'',size:2})]}),
        cols,
        new Paragraph({spacing:{before:260,after:140},children:[
          new TextRun({text:ent(t.stepsTitle),bold:true,size:23,color:INK,font:FONT})]}),
        steps,
        new Paragraph({spacing:{after:60},children:[new TextRun({text:'',size:2})]}),
        strip,
        new Paragraph({spacing:{before:200,after:140},border:{bottom:{style:BorderStyle.SINGLE,size:6,color:LINE}},children:[new TextRun({text:'',size:2})]}),
        foot,
        new Paragraph({spacing:{before:180},border:{top:{style:BorderStyle.SINGLE,size:6,color:LINE}},children:[]}),
        P(t.fineprint,{size:14,after:0})
      ]}]});
}

const DE={
 tagline:'Nachweisbare Projektkoordination über Organisationsgrenzen hinweg',
 eyebrow:'Information für Projektbeteiligte',
 eyebrow2:'Auftraggeber · Behörden · Fachplaner · Ausführende',
 h1:'Projektdaten da, wo sie hingehören &mdash; bei Ihnen.',
 sub:'Sie führen Ihren <b>eigenen Projektstand</b> und teilen daraus, was Sie teilen wollen. Jeder Beteiligte unterzeichnet seine Zusagen für die anderen &mdash; so hat jeder den Nachweis, den er braucht.',
 strap:'Kein Konto  ·  Keine Installation  ·  Kein gemeinsamer Server',
 cols:[
  {h:'Ihr eigener Projektstand',li:[
   'Ihre Zusagen, Termine, Unterlagen und Entscheidungen liegen <b>bei Ihnen</b> &mdash; nicht in der Ablage eines anderen Büros.',
   'Die Daten bleiben in Ihrem Browser, auf Ihrem Rechner. Keine Anbieter-Cloud.',
   'Er bleibt Ihrer: wenn das Projekt endet, wenn ein Beteiligter ausscheidet &mdash; <b>und auch, wenn eine Lizenz ausläuft</b>.',
   'Sie sind <b>Beteiligter, nicht Gast</b> in einem fremden System.']},
  {h:'Sie teilen zu definierten Bedingungen',li:[
   'Sie geben gezielt frei: <b>genau den Stand, genau an den Empfänger</b>.',
   'Freigegeben wird genau das Ausgewählte &mdash; <b>Ihre Vorgeschichte und Ihre internen Zwischenstände gehen nicht mit</b>.',
   'Die anderen Beteiligten geben Ihnen gegenüber nach denselben Regeln frei &mdash; mit denselben Rechten.',
   'Widersprechen sich zwei Stände, bleibt der Widerspruch stehen &mdash; <b>beiden Seiten sichtbar</b>, statt stillschweigend zusammengeführt zu werden.']},
  {h:'Sie prüfen selbst',li:[
   'Jede Zusage trägt die <b>Unterschrift dessen, der sie erklärt hat</b> &mdash; mit Zeitpunkt und Grundlage.',
   'Wird nachträglich etwas daran geändert, trägt sie <b>keine gültige Unterschrift mehr</b>. Stille Korrekturen sind ausgeschlossen.',
   'Wer für einen Vorgang nicht zuständig war, kann ihn auch nicht fortschreiben.',
   'Die Prüfung läuft bei Ihnen &mdash; <b>ohne Rückfrage bei uns und ohne Verbindung zu einem Server</b>.']}],
 stepsTitle:'So entsteht die Nachweiskette',
 steps:[
  {h:'Jeder führt seinen Stand',p:'Jedes Büro, jede Behörde, jeder Fachplaner hält den eigenen Projektstand bei sich.'},
  {h:'Jeder unterzeichnet seine Zusagen',p:'Wer eine Zusage, eine Freigabe oder einen Termin erklärt, unterzeichnet sie &mdash; und sie geht unterzeichnet an die anderen.'},
  {h:'Jeder hat seinen Nachweis',p:'Was Sie erhalten, trägt die Unterschrift dessen, der es erklärt hat. Damit ist jede Kopie so belastbar wie das Original.'}],
 stripLabel:'Was sich für Sie nicht ändert',
 stripText:'Sie arbeiten weiter mit <b>Outlook, Ihrem Dateiserver und Ihren gewohnten Programmen</b>. Sie antworten wie bisher per E-Mail. Ihre Ablage bleibt Ihre Ablage, mit Ihrer Ordnerstruktur und Ihren Aufbewahrungsfristen. Und es gibt nichts, was Sie am Projektende wieder abbauen müssten.',
 residency:'<b>Wo Ihre Daten liegen.</b> Bei Ihnen. Es gibt keine Anbieter-Cloud, in die Projektinhalte übertragen werden, keinen Ort, an dem „das Projekt“ als Ganzes liegt, und keinen Anbieter, dem Sie beitreten müssten. Geteilt wird nur, was Sie freigeben &mdash; und das können Sie jederzeit belegen.',
 mark:'Fragen zum Projekt richten Sie bitte an Ihren Projektpartner.',
 fineprint:'Eine Bestätigung im Browser ist eine Projektbestätigung im Sinne der Zusammenarbeit und keine qualifizierte elektronische Signatur nach eIDAS.'};

const EN={
 tagline:'Verifiable project coordination across organizational boundaries',
 eyebrow:'Information for project participants',
 eyebrow2:'Clients · Authorities · Specialist planners · Contractors',
 h1:'Project data where it belongs &mdash; with you.',
 sub:'You keep your <b>own project record</b> and share from it what you choose. Every party signs the commitments they make for the others &mdash; so everyone holds the paper trail they need.',
 strap:'No account  ·  No installation  ·  No common server',
 cols:[
  {h:'Your own project record',li:[
   'Your commitments, dates, documents and decisions sit <b>with you</b> &mdash; not in another office&rsquo;s filing.',
   'The data stays in your browser, on your own machine. No vendor cloud.',
   'It stays yours: when the project ends, when a participant drops out &mdash; <b>and when a licence lapses</b>.',
   'You are a <b>party to the project, not a guest</b> in someone else&rsquo;s system.']},
  {h:'You share on defined terms',li:[
   'You release deliberately: <b>exactly the state, exactly to the recipient</b>.',
   'Only the selected state is released &mdash; <b>your working history and internal drafts do not travel with it</b>.',
   'The other parties release to you under the same rules &mdash; and with the same rights.',
   'Where two records contradict each other, the conflict stands &mdash; <b>visible to both sides</b>, rather than quietly merged.']},
  {h:'You check it yourself',li:[
   'Every commitment carries the <b>signature of whoever stated it</b> &mdash; with its time and its basis.',
   'Alter it afterwards and it <b>no longer carries a valid signature</b>. Silent corrections are impossible.',
   'Whoever was not authorised for a matter cannot carry it forward either.',
   'The check runs on your own machine &mdash; <b>with no query to us and no connection to any server</b>.']}],
 stepsTitle:'How the paper trail forms',
 steps:[
  {h:'Everyone keeps their own',p:'Each office, authority and specialist planner holds their own project record.'},
  {h:'Everyone signs what they commit to',p:'Whoever states a commitment, an approval or a date signs it &mdash; and it reaches the others signed.'},
  {h:'Everyone holds their proof',p:'What reaches you carries the signature of whoever stated it. That makes every copy as sound as the original.'}],
 stripLabel:'What does not change for you',
 stripText:'You carry on with <b>Outlook, your file server and the programs you already use</b>. You reply by email as you always have. Your filing stays your filing, with your folder structure and your retention periods. And there is nothing you would have to dismantle when the project ends.',
 residency:'<b>Where your data lives.</b> With you. There is no vendor cloud that project content is transferred to, no single place where &ldquo;the project&rdquo; sits as a whole, and no vendor you have to join. Only what you release is shared &mdash; and you can evidence that at any time.',
 mark:'Please direct questions about the project to your project partner.',
 fineprint:'A confirmation made in the browser is a project acknowledgement between the parties working together, not a qualified electronic signature under eIDAS.'};

(async()=>{
  for(const [name,t] of [['flyer-de.docx',DE],['flyer-en.docx',EN]]){
    fs.writeFileSync(name, await Packer.toBuffer(build(t)));
    console.log('wrote', name);
  }
})();
