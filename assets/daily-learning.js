(function () {
  "use strict";

  var PREVIEW = new URLSearchParams(location.search).get("assessmentPreview") === "1";
  var oldExtras = window.renderExtras;
  var oldRender = window.render;
  var banks = {};
  var notes = [
    ["Cloud services are computers and software you use over the internet. IaaS gives you computing building blocks, PaaS gives you a place to build apps, and SaaS gives you a finished app.", "Engineering teams use cloud tools to store designs, run apps, share data, and scale services without buying every server.", "Choose a suitable cloud model and explain the trade-offs in cost, control, and responsibility."],
    ["Security means keeping information private, correct, and available. Use strong sign-in checks, protect personal data, and stop to check suspicious messages.", "Engineers handle valuable designs and customer data. A small safe habit can prevent a large problem.", "Spot common threats and explain practical steps such as MFA, least privilege, and reporting."],
    ["AI finds patterns. Machine learning learns from examples. Generative AI can draft text or code, but it can also be wrong.", "AI tools can save time on engineering work when a person checks the answer and protects sensitive information.", "Write a clear prompt, review the result, and explain how you checked it."],
    ["IoT connects sensors and machines so they can share information. Blockchain is a shared record that is difficult to change without detection.", "Factories use connected devices to monitor equipment, improve quality, and reduce downtime. Shared records can help trace important events.", "Map a sensor-to-insight path and identify when a shared ledger may help."],
    ["AR adds digital details to the real world. VR creates a virtual world. Drones collect useful views, and 3D printing builds parts layer by layer.", "These tools help engineers design, inspect, train, and make things in new ways.", "Choose a future technology for a real engineering need and explain its value and limits."]
  ];

  /* Each row: concept, simple meaning, scenario, good action, misconception,
     correction, useful result, Mentor Kapil's hint. */
  var facts = [
    [
      ["IaaS","Rent computing building blocks such as virtual machines, storage, and networks; the customer manages its operating system and apps.","A startup wants control of its server setup but does not want to buy physical servers.","Choose virtual infrastructure and plan who patches the operating system.","IaaS means the provider manages every layer of my application.","The provider manages the physical cloud; the customer still manages its workloads and access.","More server control without buying data-center hardware.","Think of IaaS as renting the building blocks, then managing what you put on them."],
      ["PaaS","Use a managed platform to build and run an app without managing the underlying servers.","A team wants to deploy a web app and focus on its code instead of patching servers.","Deploy application code to the provider-managed runtime.","PaaS means developers no longer need to maintain their code.","The provider manages the platform; the team still owns its code, data, and app quality.","Faster app development with less server maintenance.","Ask which layer the provider manages and which layer the developer still owns."],
      ["SaaS","Use a complete application hosted and maintained by a provider.","A college team needs email and shared calendars without building its own mail server.","Choose a hosted application and manage user access.","SaaS is only a way to rent raw servers.","SaaS provides finished software that people use through an app or browser.","Ready-to-use software with provider-managed updates.","A finished product used by people is usually SaaS."],
      ["Public cloud","Use cloud services delivered to many customers over shared provider infrastructure.","A project needs online storage that can grow quickly without a private data center.","Select a provider service and configure secure accounts and data access.","Public cloud means every customer's files are visible to everyone.","Customers share the provider's infrastructure while their accounts and data remain logically separated.","Fast access to scalable services with little hardware setup.","Public describes the provider's service model, not public access to your files."],
      ["Private cloud","Use cloud infrastructure dedicated to one organization.","A regulated lab needs tighter control over its computing environment.","Choose a dedicated environment and plan its higher operating needs.","Private cloud always means there are no internet-connected systems.","A private cloud is dedicated to one organization and can still use modern networks.","More organizational control over the cloud environment.","Private means dedicated to one organization, not automatically safer by itself."],
      ["Hybrid cloud","Connect private infrastructure with public cloud services and move work between them.","A company keeps sensitive records in its own environment and runs a public web app.","Plan secure connections, identity, and which data belongs in each environment.","Hybrid cloud means using two unrelated systems with no connection.","Hybrid cloud links environments so data or applications can work across them.","Balance local control with public-cloud flexibility.","Look for a real connection between private and public environments."],
      ["Scalability","Increase or reduce system capacity to handle changing demand.","An online service expects more users during exam-result week.","Plan capacity that can grow to meet expected demand.","Scalability only means making a computer physically larger.","A scalable service can support more workload by adding resources or distributing work.","Handle growth without redesigning the entire service.","Think about whether the system can handle more users or work."],
      ["Elasticity","Automatically adjust resources up or down as demand changes.","A ticket website gets a sudden rush and then becomes quiet again.","Use automatic scaling rules linked to workload signals.","Elasticity means keeping the largest servers running all the time.","Elastic systems add resources when demand rises and release them when demand falls.","Respond to changing demand while avoiding idle capacity.","Scalability supports growth; elasticity adjusts with changing demand."],
      ["Shared responsibility","Cloud security work is divided between the provider and the customer.","A team moves a database to a managed cloud service and must still control who can access it.","Check the service model and assign clear customer and provider duties.","The cloud provider is responsible for every security decision.","The provider secures its cloud infrastructure while customers protect their accounts, data, and configuration.","Fewer gaps caused by unclear ownership.","Always ask which security layer belongs to the customer."],
      ["Cloud cost management","Track cloud use and choose resources that fit the actual workload.","A project bill rises because test servers are left running overnight.","Review usage, set budgets, and stop resources that are no longer needed.","Cloud services are always free once they are online.","Cloud costs depend on selected services and how much they are used.","Fewer surprise bills and better use of project funds.","Pay attention to usage, idle resources, and budget alerts."]
    ],
    [
      ["Confidentiality","Keep information visible only to people who are allowed to see it.","A team stores student records and needs to limit access to authorized staff.","Use access controls and protect sensitive data from unnecessary sharing.","Confidentiality means data is always available to every user.","Confidentiality limits information access to approved people and systems.","Less risk of private information being exposed.","Ask who truly needs to see the information."],
      ["Integrity","Keep information accurate and prevent unauthorized changes.","An engineer checks that a design file was not altered after approval.","Use controlled edits, version history, and checks that reveal unexpected changes.","Integrity is only about preventing someone from reading a file.","Integrity helps ensure information remains correct and changes are authorized.","More trustworthy records and engineering decisions.","Integrity is about correctness and trusted change."],
      ["Availability","Make systems and information accessible when authorized users need them.","A factory needs its maintenance dashboard to work during a production shift.","Plan backups, monitoring, and recovery for service outages.","Availability means removing all login controls.","Availability means a service can be reached by authorized users when needed.","Less disruption when a system or network fails.","Security includes keeping services usable, not just blocking threats."],
      ["Authentication","Check that a person or system is who it claims to be.","A staff portal asks a learner to sign in before showing personal results.","Verify identity with a trusted sign-in method.","Authentication decides what every signed-in user is allowed to do.","Authentication verifies identity; authorization decides what that identity can access.","Fewer impostors accessing accounts.","Authentication asks who you are; authorization asks what you can do."],
      ["Multi-factor authentication","Use more than one kind of proof to verify a sign-in.","A password alone is not enough to protect an engineering account.","Add a second factor such as an authenticator prompt or security key.","MFA means using two passwords.","MFA combines different proof types, such as something known and something possessed.","A stolen password alone is less likely to unlock the account.","Different kinds of proof are stronger than repeating the same kind."],
      ["Phishing","A deceptive message tries to trick someone into sharing data or opening unsafe content.","An urgent email asks an employee to enter a password on an unfamiliar site.","Check the sender and link, avoid opening it, and report it through a trusted route.","Every message with a logo is safe.","Phishing uses impersonation or pressure to make a person act unsafely.","More chances to stop account theft before it starts.","Urgency plus an unexpected credential request is a warning sign."],
      ["Data minimization","Collect and keep only the personal data needed for a clear purpose.","A workshop registration form asks for a birth certificate even though it only needs a name and email.","Remove fields that are not needed and limit how long information is kept.","Data minimization means saving every detail in one large file.","A team should limit data collection to what its task actually needs.","Less sensitive data to protect and fewer privacy risks.","If a field has no clear purpose, question why it is collected."],
      ["Encryption","Transform readable information so only someone with the right key can read it.","A team sends private project files across a public network.","Use trusted encryption in transit and at rest, and protect the keys.","Encryption proves that a message came from a trustworthy sender.","Encryption makes data difficult to read without the correct key, but does not by itself prove who sent it.","Less chance that intercepted data can be understood.","Encryption protects secrecy; still check the sender and system."],
      ["Least privilege","Give each user only the access needed for their current work.","A temporary intern needs to view one project folder but not change payroll records.","Grant narrow access and review it when the task ends.","Least privilege means everyone gets administrator access in case they need it.","Access should be limited to the minimum required and removed when it is no longer needed.","Less damage if an account is misused.","Start with the smallest access that lets the person do the task."],
      ["Incident reporting","Tell the right people quickly when a security problem may have happened.","A learner entered a password on a suspicious page and now sees an unfamiliar sign-in.","Report the event using the organization's trusted security process.","Reporting is only needed after you can prove data was stolen.","Early reporting lets the response team investigate and reduce possible harm.","Faster containment and clearer recovery steps.","When in doubt, report promptly through a known channel."]
    ],
    [
      ["Artificial intelligence","A broad field of building systems that perform tasks associated with human intelligence.","A team uses software to recognize patterns in inspection images.","Identify the task, data, and limits before choosing an AI tool.","AI always thinks and understands exactly like a person.","AI systems perform specific tasks using rules, data, or learned patterns; their abilities have limits.","Automate or assist with tasks that would otherwise take human time.","Ask what task the system is actually designed to perform."],
      ["Machine learning","A way for a computer to learn patterns from examples and use them for predictions.","A factory uses past sensor readings to estimate whether a motor may fail.","Use suitable examples to train and evaluate a model for the intended task.","Machine learning works without data or examples.","Machine learning finds patterns in data and must be checked on relevant examples.","Useful predictions when the data represents the real problem.","A model learns patterns from examples; data quality matters."],
      ["Training data","Examples used to teach a machine-learning model patterns.","A vision model learns to identify surface defects from labeled inspection images.","Use relevant, well-labeled examples and check them for gaps or bias.","Training data is the final answer produced by a model.","Training data helps a model learn; it does not guarantee correct predictions.","Better learning when examples fit the real use case.","Ask who created the examples and what they might leave out."],
      ["Generative AI","AI that creates new content such as text, images, or code from a prompt.","An engineer asks an assistant to draft a first version of a project summary.","Give clear instructions, then review generated material before using it.","Generative AI only searches and copies exact existing paragraphs.","Generative AI produces new outputs from learned patterns and can still make mistakes.","A quicker first draft that a person can improve.","Treat a generated result as a draft, not a verified fact."],
      ["Prompt context","Useful background that tells an AI tool the audience, goal, and constraints.","A learner needs an explanation of a code snippet for a beginner.","State the audience, goal, relevant details, and desired format.","A prompt is better when it hides the task and audience.","Relevant context helps the tool produce a more useful answer.","Less back-and-forth and output that better fits the task.","Say who the answer is for and what a good answer should include."],
      ["Output validation","Check an AI result against reliable evidence before relying on it.","An assistant suggests a formula that will be used in a safety report.","Verify calculations, sources, code behavior, and assumptions independently.","A confident tone proves the answer is correct.","Validation compares the output with trusted evidence and the real requirements.","Fewer errors moving from draft to engineering work.","Check important claims before they enter a design or report."],
      ["AI hallucination","A generated answer that sounds plausible but is incorrect or unsupported.","An assistant invents a technical standard number that does not exist.","Check the reference in an authoritative source before citing it.","A hallucination only happens when a system refuses a question.","Generative systems can produce fluent but false details.","Avoid relying on invented facts in reports or decisions.","Fluent wording is not proof that a claim is real."],
      ["AI bias","A systematic unfair pattern in an AI result, often linked to data or design choices.","A hiring model scores one group lower because past examples were unbalanced.","Review who is represented and test results across affected groups.","More data automatically removes every kind of bias.","Bias can remain in data, labels, design, or how a system is used.","Fairer decisions when problems are found and addressed.","Ask which people may be missing or misrepresented in the data."],
      ["Human review","A person checks AI-assisted work using knowledge and responsibility.","An engineer uses a code assistant before merging changes into a shared project.","Review correctness, security, and fit before approving the output.","Human review is unnecessary when a tool is popular.","A qualified person remains responsible for important decisions and outputs.","Safer and more accountable use of AI assistance.","Keep a human responsible for high-impact work."],
      ["Coding assistant","An AI tool that can suggest, explain, or draft code from instructions.","A learner asks for a small example and wants to understand how each line works.","Run and inspect the code, test edge cases, and protect private information.","Suggested code is guaranteed secure because it compiles.","A coding assistant can speed up drafting but may miss bugs or risks.","A useful starting point for learning and development.","Read, run, and test every suggestion before trusting it."]
    ],
    [
      ["IoT sensor","A device that measures a physical condition such as temperature or vibration.","A motor sends vibration readings so a team can detect wear.","Choose a sensor suited to the measurement and collect readings safely.","A sensor changes a machine's physical behavior by itself.","A sensor observes a condition and sends a measurement for further use.","Earlier awareness of changes in equipment or environment.","A sensor measures; another component may act on the measurement."],
      ["Actuator","A component that creates a physical action, such as opening a valve or moving a motor.","A greenhouse system uses a control signal to open a vent.","Connect the actuator to a safe control rule and verify its response.","An actuator only measures temperature or pressure.","An actuator changes something in the physical environment.","Automated response to a measured condition.","Sensor observes; actuator acts."],
      ["IoT gateway","A device that connects local sensors or machines to a wider network or platform.","Several workshop sensors use one local device to forward readings to a dashboard.","Route data through a gateway and check its protocol and security settings.","A gateway is the same thing as a blockchain ledger.","A gateway can collect, translate, filter, or forward device data.","Simpler and more organized communication between devices and platforms.","Think of a gateway as a bridge between device networks and services."],
      ["Edge computing","Process data close to where it is created instead of sending everything far away.","A safety system must react quickly even when the internet connection is slow.","Handle urgent local decisions near the equipment and send useful summaries onward.","Edge computing means every calculation happens in a distant cloud.","Edge processing can reduce delay and network traffic for local needs.","Faster response when sending data to a distant service would take too long.","Use the edge when low delay or unreliable links matter."],
      ["IoT communication protocol","A set of rules that devices use to exchange messages.","A sensor and dashboard must agree on how readings are formatted and delivered.","Select a protocol suited to device limits, range, and message needs.","A protocol is the physical sensor that measures the environment.","Protocols define how connected systems communicate and interpret messages.","Fewer integration problems between devices and services.","Devices need shared communication rules before they can work together."],
      ["Blockchain block","A record package that groups transactions with a link to earlier records.","A supply-chain system groups verified shipping events into a ledger update.","Check the block contents and its link to the prior block.","A block is a private password that encrypts a computer.","Blocks contain records and cryptographic links that help reveal changes.","A traceable sequence of records over time.","A block is one part of a linked record history."],
      ["Distributed ledger","A shared record maintained across multiple participating computers.","Several partners need to see the same verified delivery history.","Agree on who may participate and how updates are accepted.","A distributed ledger is a single spreadsheet owned by one user.","A distributed ledger shares synchronized records across participants.","A common view of agreed records between organizations.","Ask who maintains the copies and who is allowed to update them."],
      ["Cryptographic hash","A fixed-length digital fingerprint calculated from data.","A team compares a file's hash before and after transfer to detect a change.","Recalculate the fingerprint and compare it with the trusted value.","A hash is a method to recover the original secret text.","A hash helps detect changes but is not designed to reveal the original data.","Evidence that a record or file may have changed.","A changed input should produce a different fingerprint."],
      ["Smart contract","Program code on a ledger that runs agreed actions when conditions are met.","Partners want a payment released after a verified delivery event.","Define and test the rules carefully before the contract is used.","A smart contract is a legal contract that can never contain a bug.","Smart-contract code can automate agreed rules but still needs review and safeguards.","Less manual work for predictable steps when rules are clear.","Automation follows the coded rule, so check the rule before deployment."],
      ["Blockchain use case","Use a shared ledger when several parties need a traceable, agreed record.","Manufacturers and suppliers want to trace a component's recorded handoffs.","Compare a ledger with a normal database and use one only if shared verification adds value.","Blockchain is the best database for every engineering problem.","A ledger may help when multiple parties need shared records that are hard to alter unnoticed.","More traceable handoffs between organizations.","Start with the problem; do not choose a blockchain just because it is new."]
    ],
    [
      ["Augmented reality","Add digital information over a view of the real world.","A technician needs repair arrows visible on the real machine.","Show guidance aligned with the equipment while keeping the real workspace visible.","AR replaces the real world with a fully virtual space.","AR combines real surroundings with digital overlays.","In-place guidance while a person continues to see the actual equipment.","Overlay means the real world remains visible."],
      ["Virtual reality","Place a person inside a computer-generated environment.","A training team wants learners to practice in a simulated factory before entering the real one.","Create an immersive virtual scene and provide safe controls for the learner.","VR only adds labels to a live camera view.","VR creates an immersive environment that can replace the user's view of the real world.","Practice in a simulated environment without using the live equipment.","If the real scene is replaced, think VR."],
      ["Mixed reality","Blend digital objects with the real world so they can appear anchored and interactive.","A design team places a shared 3D engine model in a real workshop for review.","Anchor digital objects to real spaces and check alignment and interaction.","MR means using a flat paper drawing instead of digital content.","Mixed reality can connect digital content with the physical environment in interactive ways.","Teams can inspect a digital model in the context of a real space.","Look for digital and physical elements interacting together."],
      ["Engineering drone","An unmanned aircraft that can capture data or perform tasks from the air.","A site team needs images of a large roof that is difficult to inspect by hand.","Plan a lawful, safe flight and collect only the data needed for the inspection.","A drone is a 3D printer carried through the air.","Drones can collect aerial images or sensor readings for engineering work.","Reach or inspect areas that are difficult or risky to access directly.","Plan the safety and purpose before launching a drone."],
      ["3D printing","Build a physical object by adding material in layers from a digital design.","A prototype team needs a custom bracket to check fit before ordering production parts.","Prepare the model, select a material, and inspect the printed result.","3D printing removes the need for a digital model.","3D printing uses a digital design to form an object layer by layer.","Quick physical prototypes for fit and design checks.","A digital model guides the printed layers."],
      ["Additive manufacturing workflow","Move from a digital design through preparation, printing, and inspection.","A lab wants repeatable printed parts that meet dimensional requirements.","Check the model, orientation, material, machine setup, and finished dimensions.","Printing starts before the model or material is selected.","A reliable workflow prepares the design and material, prints, then checks the result.","More consistent parts and fewer avoidable print failures.","Remember prepare, print, inspect."],
      ["Rapid prototyping","Build an early model quickly to learn what should change before final production.","Engineers want to test whether a new handheld tool is comfortable to use.","Make a low-cost version, gather feedback, and refine the design.","A prototype is always the final approved product.","A prototype helps a team test ideas before committing to full production.","Earlier feedback and less risk of expensive late changes.","Use the prototype to learn, then improve it."],
      ["Human-centered design","Design a tool around people's real needs, abilities, and working conditions.","Technicians struggle to use a complex display while wearing gloves.","Observe users and test the interface in realistic conditions.","Human-centered design means adding as many features as possible.","A useful design fits the needs and limits of the people who will use it.","Tools that are easier, safer, and more useful in practice.","Begin with the people and task, not the technology."],
      ["Technology safety review","Check hazards and safeguards before people use a new tool or system.","A drone will fly near workers during an inspection.","Identify hazards, set operating rules, and plan what to do if something goes wrong.","A successful demonstration proves a technology is safe for every situation.","Safety depends on the setting, users, training, and safeguards as well as the device.","Fewer preventable incidents during real use.","Ask what can go wrong and how people will be protected."],
      ["Sustainable technology choice","Consider energy, materials, repair, and long-term impact when selecting technology.","A team compares two sensors with different energy use and replacement needs.","Compare total lifecycle impact, not only the purchase price.","Sustainability only means buying the newest device.","A sustainable choice considers resources and impacts over the technology's useful life.","Less waste and more responsible long-term engineering.","Think about the full lifecycle, from materials to end of use."]
    ]
  ];

  function escText(value) { return String(value).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function shuffle(list) { var a=list.slice(); for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;} return a; }
  function unique(list) { return list.filter(function(x,i){return list.indexOf(x)===i;}); }
  function bank(day) {
    if (banks[day]) return banks[day];
    var rows=facts[day], result=[];
    rows.forEach(function(f,fi){
      var others=rows.filter(function(_,j){return j!==fi;});
      function add(kind,stem,correct,alternatives){
        var opts=shuffle(unique([correct].concat(shuffle(alternatives.filter(function(x){return x!==correct;})).slice(0,3))));
        result.push({id:day+"-"+fi+"-"+kind,q:stem,options:opts,correct:correct,hint:f[7]});
      }
      add("meaning","Which statement best describes "+f[0]+"?",f[1],others.map(function(x){return x[1];}));
      add("scenario",f[2]+" Which concept is the closest match?",f[0],rows.filter(function(_,j){return j!==fi;}).map(function(x){return x[0];}));
      add("action",f[2]+" If you are applying "+f[0]+", what is the best next step?",f[3],others.map(function(x){return x[3];}));
      add("myth","A teammate says: "+f[4]+" Which response is most accurate?",f[5],others.map(function(x){return x[5];}));
      add("outcome","What is a practical outcome of "+f[0]+"?",f[6],others.map(function(x){return x[6];}));
    });
    banks[day]=result;
    return result;
  }

  function ensureState() {
    state.assessments=state.assessments||{};
    state.wheel=state.wheel||{};
    state.dayBadges=state.dayBadges||[];
  }
  function persist() { localStorage.setItem("fieldGuideState",JSON.stringify(state)); }
  function updateNumbers() {
    if (typeof $==="function" && $("xpMetric")) $("xpMetric").textContent=state.xp||0;
    if (typeof $==="function" && $("badgeMetric")) $("badgeMetric").textContent=unique((state.dayBadges||[]).concat(state.done||[])).length;
  }
  function phase(day,name) {
    ensureState();
    state.assessments[day]=state.assessments[day]||{};
    state.assessments[day][name]=state.assessments[day][name]||{attempts:[],passed:false,active:null};
    return state.assessments[day][name];
  }
  function windowStatus(name) {
    if (PREVIEW) return {open:true,label:"Preview mode · time window bypassed"};
    var d=new Date(),m=d.getHours()*60+d.getMinutes();
    var start=name==="pre"?9*60:16*60, end=name==="pre"?12*60:19*60;
    if(m>=start&&m<end) return {open:true,label:name==="pre"?"Open now · closes at 12:00 noon":"Open now · closes at 7:00 PM"};
    return {open:false,label:name==="pre"?"Available daily · 9:00 AM–12:00 PM":"Available daily · 4:00 PM–7:00 PM"};
  }
  function phaseCard(day,name) {
    var s=phase(day,name), w=windowStatus(name), title=name==="pre"?"Pre-assessment":"Post-assessment";
    var result=s.attempts.length?(" · "+s.attempts.length+"/2 attempts · latest "+s.attempts[s.attempts.length-1].score+"/50"):"";
    var canStart=w.open&&s.attempts.length<2;
    var active=s.active!==null;
    var label=active?"Resume assessment":s.attempts.length===0?"Start 50-question assessment":s.attempts.length===1?"Use your one retake":"Review last result";
    var fn=s.attempts.length>=2?"reviewAssessment":"launchAssessment";
    return '<article class="assessment-card"><div class="assessment-top"><span class="assessment-kicker">'+title+'</span><span class="assessment-status '+(s.passed?"passed":canStart?"available":"closed")+'">'+(s.passed?"PASSED":canStart?"AVAILABLE":"WINDOW")+'</span></div><div class="assessment-window">'+w.label+'</div><p>50 unique MCQs · same day topic · one retake'+result+'</p><button class="action '+(canStart?"":"secondary")+'" '+(!canStart&&s.attempts.length<2?"disabled":"")+' onclick="'+fn+'('+day+",'"+name+"')">'+label+'</button></article>';
  }
  function assessmentPanel(day) {
    return '<section class="panel assessments-panel"><div class="panelhead"><div><h3>Daily assessments</h3><p class="assessment-sub">Pre and post use the same 50 questions. Each phase includes one retake.</p></div><span class="status">50 MCQs</span></div><div class="assessment-grid">'+phaseCard(day,"pre")+phaseCard(day,"post")+'</div><div class="mentor-note"><b>Mentor Kapil’s tip</b> · Treat the pre-assessment as a baseline. Use the lesson to close any gaps, then return for the post-assessment.</div></section>';
  }
  function dayNote(day) {
    var n=notes[day];
    return '<section class="panel simple-notes"><div class="panelhead"><div><span class="eyebrow" style="color:#5368c9">THE SIMPLE VERSION</span><h3>What you’ll learn today</h3></div><span class="status">WHY IT MATTERS</span></div><div class="note-columns"><div><b>In easy words</b><p>'+n[0]+'</p></div><div><b>Why engineers learn this</b><p>'+n[1]+'</p></div><div><b>By the end, you can</b><p>'+n[2]+'</p></div></div></section>';
  }

  function wheelState(day) {
    ensureState();
    var s=state.wheel[day];
    if(!s){var pool=shuffle(bank(day).map(function(_,i){return i;})).slice(0,25);s={pool:pool,seen:[],current:null,turns:0,answered:null};state.wheel[day]=s;persist();}
    return s;
  }
  function wheelLabels() {
    var out="";
    for(var i=0;i<25;i++){var angle=i*14.4;out+='<span style="transform:rotate('+angle+'deg) translateY(-92px) rotate(-'+angle+'deg)">'+(i+1)+'</span>';}
    return out;
  }
  function wheelQuestion(day) {
    var s=wheelState(day), q=s.current===null?null:bank(day)[s.current];
    if(!q) return '<div class="wheel-question" id="wheelQuestion"><p class="wheel-empty">Spin to draw one of today’s 25 unique practice questions.</p></div>';
    var choices=q.options.map(function(opt,i){return '<label class="wheel-choice"><input type="radio" name="wheelAnswer" value="'+i+'"><span>'+escText(opt)+'</span></label>';}).join("");
    return '<div class="wheel-question" id="wheelQuestion"><b>'+escText(q.q)+'</b><div class="wheel-options">'+choices+'</div><button class="action" onclick="submitWheel('+day+')">Check answer</button><div class="mentor-note">Mentor Kapil’s hint: '+escText(q.hint)+'</div></div>';
  }
  function wheelPanel(day) {
    var s=wheelState(day), done=s.seen.length, exhausted=done>=25;
    var segments=[];
    for(var n=0;n<25;n++){var color=n%2?"#edf1ff":"#dfe7ff";segments.push(color+" "+(n*14.4)+"deg "+((n+1)*14.4)+"deg");}
    var current=s.current!==null;
    return '<section class="panel wheel-panel"><div class="panelhead"><div><h3>Daily spin challenge</h3><p class="assessment-sub">Spin through 25 distinct questions from today’s topic.</p></div><span class="status">'+done+' / 25</span></div><div class="wheel-layout"><div class="wheel-stage"><div class="wheel-pointer"></div><div class="spin-wheel" id="spinWheel" style="background:conic-gradient('+segments.join(",")+')">'+wheelLabels()+'<div class="wheel-hub">SPIN<br><small>25 Q</small></div></div><button class="action wheel-spin" onclick="spinWheel('+day+')" '+(current||exhausted?'disabled':'')+'>'+(exhausted?"Challenge complete":current?"Answer this question":"Spin the wheel")+'</button></div><div class="wheel-copy"><div class="eyebrow" style="color:#5368c9">ONE QUESTION PER SPIN</div><p>Every question is different. Correct answers earn <b>5 XP</b>. Questions you’ve answered won’t return.</p><div id="wheelQuestionHost">'+wheelQuestion(day)+'</div></div></div></section>';
  }

  window.renderExtras=function(day){
    var base=oldExtras?oldExtras(day):"";
    var cert=phase(day,"post").passed?'<button class="action secondary" onclick="openCertificate('+day+')">Download daily certificate · PNG or PDF</button>':'<div class="certificate-lock">Pass today’s post-assessment to unlock your daily certificate.</div>';
    return base+dayNote(day)+'<div class="daily-tools">'+assessmentPanel(day)+wheelPanel(day)+'</div><section class="panel day-award"><div><span class="eyebrow" style="color:#5368c9">DAILY RECOGNITION</span><h3>Badge, XP & certificate</h3><p>Pass the post-assessment to earn today’s badge and unlock a professional certificate.</p></div>'+cert+'</section>';
  };

  document.head.insertAdjacentHTML("beforeend","<style>"+
    ".daily-tools{display:grid;gap:16px;margin:0 0 19px}.simple-notes{margin:0 0 16px;border-left:4px solid #6e8cff}.note-columns{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.note-columns b{font-size:12px;color:#24314e}.note-columns p,.assessment-sub{font-size:12px;line-height:1.6;color:var(--muted);margin:6px 0 0}.assessments-panel,.wheel-panel{background:linear-gradient(145deg,#fff,#fbfcff)}.assessment-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.assessment-card{border:1px solid var(--line);border-radius:14px;padding:15px;background:#fff}.assessment-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.assessment-kicker{font:700 13px Manrope}.assessment-status{border-radius:99px;padding:5px 8px;font:10px 'DM Mono';background:#f0f2f7;color:#6a7284}.assessment-status.available{background:#e2f7eb;color:#22734d}.assessment-status.passed{background:#e9eaff;color:#394cb4}.assessment-window{margin-top:11px;font-size:11px;font-weight:700;color:#56617a}.assessment-card p{font-size:11px;line-height:1.5;color:var(--muted);min-height:33px}.assessment-card .action{font-size:11px;padding:9px 11px}.mentor-note{margin-top:12px;padding:11px 13px;background:#f2f5ff;border-radius:10px;color:#59637b;font-size:11px;line-height:1.55}.mentor-note b{color:#354da9}.wheel-layout{display:grid;grid-template-columns:290px 1fr;gap:20px;align-items:center}.wheel-stage{display:flex;flex-direction:column;align-items:center;position:relative;padding:4px 0}.spin-wheel{width:228px;height:228px;border:8px solid #fff;box-shadow:0 10px 30px #24386b20;border-radius:50%;position:relative;transition:transform 3.6s cubic-bezier(.12,.72,.08,1);display:grid;place-items:center}.spin-wheel:after{content:'';position:absolute;inset:0;border-radius:50%;background:repeating-conic-gradient(from -7.2deg,transparent 0deg 14deg,#ffffffd9 14deg 14.45deg)}.spin-wheel>span{position:absolute;left:50%;top:50%;margin-left:-9px;margin-top:-7px;font:9px 'DM Mono';color:#344268;z-index:1}.wheel-hub{width:67px;height:67px;border-radius:50%;background:#152444;color:white;display:grid;place-content:center;text-align:center;font:700 12px Manrope;z-index:2;box-shadow:0 0 0 5px #fff}.wheel-hub small{font:9px 'DM Mono';color:#b8c7ff}.wheel-pointer{position:absolute;top:-1px;z-index:3;width:0;height:0;border-left:12px solid transparent;border-right:12px solid transparent;border-top:25px solid #f6a751}.wheel-spin{margin-top:14px}.wheel-copy>p{color:var(--muted);font-size:12px;line-height:1.6}.wheel-question{margin-top:13px;padding:13px;background:#f8f9fc;border:1px solid var(--line);border-radius:12px}.wheel-question>b{font-size:12px;line-height:1.55}.wheel-empty{font-size:12px;color:var(--muted)}.wheel-options{display:grid;gap:7px;margin:12px 0}.wheel-choice{display:flex;align-items:flex-start;gap:8px;padding:8px 9px;border:1px solid var(--line);border-radius:9px;background:#fff;font-size:11px;line-height:1.45;cursor:pointer}.wheel-choice input{margin-top:2px}.wheel-question .mentor-note{font-size:10px}.day-award{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:0 0 19px}.day-award h3{margin:6px 0}.day-award p{font-size:12px;color:var(--muted);margin:0}.certificate-lock{font-size:11px;color:#6f7890;text-align:right}.assess-overlay,.certificate-overlay{position:fixed;inset:0;background:#0b1429e8;z-index:50;display:none;align-items:center;justify-content:center;padding:18px}.assess-overlay.show,.certificate-overlay.show{display:flex}.assess-window{width:min(900px,100%);max-height:94vh;overflow:auto;background:#f7f8fb;border-radius:20px;box-shadow:0 25px 80px #0005}.assess-head{background:#111d3a;color:white;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:2}.assess-head h2{font:800 20px Manrope;margin:4px 0}.assess-head p{font-size:11px;color:#b7c3de;margin:0}.assess-close{border:1px solid #ffffff40;background:#ffffff12;color:white;border-radius:9px;padding:9px 12px}.assess-progress{height:5px;background:#e6e9f1}.assess-progress i{display:block;height:100%;background:#5978ff}.assess-body{padding:24px}.assess-meta{display:flex;justify-content:space-between;color:#778096;font:11px 'DM Mono';margin-bottom:12px}.assess-question{font:700 19px/1.4 Manrope;margin:0 0 17px}.assess-options{display:grid;gap:9px}.assess-option{display:flex;gap:11px;align-items:flex-start;border:1px solid #e3e6ed;border-radius:12px;padding:13px;background:#fff;cursor:pointer;font-size:13px;line-height:1.5}.assess-option.selected{border-color:#5e7aff;background:#eef2ff}.assess-option input{margin-top:3px}.assess-controls{display:flex;justify-content:space-between;gap:10px;margin-top:20px}.assess-hint{margin-top:14px}.assess-hint summary{cursor:pointer;font-size:12px;font-weight:700;color:#4057b3}.assess-hint p{background:#f1f4ff;padding:12px;border-radius:9px;color:#52607b;font-size:12px;line-height:1.5}.assess-result{padding:27px;text-align:center}.assess-result h3{font:800 27px Manrope;margin:8px}.assess-result .score{font:800 54px Manrope;color:#3656d9}.assess-result p{color:var(--muted);font-size:13px;line-height:1.6}.assess-result .action{margin:7px}.certificate-card{width:min(700px,100%);background:#fffdf7;border:7px double #c9a454;padding:30px;text-align:center;color:#1b2947;box-shadow:0 25px 80px #0005}.certificate-card h2{font:800 28px Manrope;margin:11px 0}.certificate-card .recipient{font:700 25px Manrope;color:#2c416e;margin:15px}.certificate-card p{font-size:13px;line-height:1.6;color:#5d6576}.certificate-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:22px}.cert-seal{font-size:34px;color:#b58e39}.day-award .action{white-space:nowrap}@media(max-width:760px){.note-columns,.assessment-grid,.wheel-layout{grid-template-columns:1fr}.wheel-stage{padding-top:20px}.day-award{align-items:flex-start;flex-direction:column}.certificate-lock{text-align:left}.assess-body{padding:17px}.assess-question{font-size:16px}}"+
    "</style>");
  document.body.insertAdjacentHTML("beforeend",'<div class="assess-overlay" id="assessmentModal" role="dialog" aria-modal="true"></div><div class="certificate-overlay" id="certificateModal" role="dialog" aria-modal="true"></div>');

  function portalAllowed(day) { var preview=typeof PORTAL_PREVIEW!=="undefined"&&PORTAL_PREVIEW; var hr=new Date().getHours(); return (preview||(hr>=8&&hr<20))&&(typeof access!=="function"||access(day).status!=="locked"); } function assessmentWindowOpen(name) { return windowStatus(name).open; }
  function startAttempt(day,name) {
    var s=phase(day,name), ids=shuffle(bank(day).map(function(_,i){return i;}));
    s.active={ids:ids,at:0,answers:{},hint:false,started:new Date().toISOString()};
    persist();
  }
  window.launchAssessment=function(day,name) {
    var s=phase(day,name);
    if(!portalAllowed(day)){toast("Portal is closed for maintenance. It opens daily at 8:00 AM.");return;}if(s.attempts.length>=2){window.reviewAssessment(day,name);return;}
    if(!assessmentWindowOpen(name)||!portalAllowed(day)){toast("The portal or assessment window is closed. Check the daily access hours.");return;}
    if(!s.active)startAttempt(day,name);
    paintAssessment(day,name);
  };
  window.closeAssessment=function(day) {
    var modal=document.getElementById("assessmentModal");modal.classList.remove("show");
    if(typeof openDay==="function"&&day>=0)openDay(day,true);
  };
  function paintAssessment(day,name) {
    var s=phase(day,name), a=s.active;
    if(!a){window.reviewAssessment(day,name);return;}
    var q=bank(day)[a.ids[a.at]], chosen=a.answers[q.id]||"";
    var opts=q.options.map(function(option,i){return '<label class="assess-option '+(chosen===option?"selected":"")+'"><input type="radio" name="assessmentChoice" value="'+i+'" '+(chosen===option?"checked":"")+' onchange="saveAssessmentAnswer('+day+',\''+name+'\','+i+')"><span>'+escText(option)+'</span></label>';}).join("");
    var progress=Math.round((a.at+1)/50*100);
    document.getElementById("assessmentModal").innerHTML='<div class="assess-window"><header class="assess-head"><div><div class="eyebrow" style="color:#aebeff">DAY 0'+(day+1)+' · '+(name==="pre"?"PRE-ASSESSMENT":"POST-ASSESSMENT")+'</div><h2>50-question knowledge check</h2><p>Same question set for both phases · one retake · local-time access window</p></div><button class="assess-close" onclick="closeAssessment('+day+')">Save & close</button></header><div class="assess-progress"><i style="width:'+progress+'%"></i></div><div class="assess-body"><div class="assess-meta"><span>QUESTION '+(a.at+1)+' OF 50</span><span>'+Object.keys(a.answers).length+' ANSWERED</span></div><h3 class="assess-question">'+escText(q.q)+'</h3><div class="assess-options">'+opts+'</div><details class="assess-hint" '+(a.hint?"open":"")+'><summary>Mentor Kapil’s hint</summary><p>'+escText(q.hint)+'</p></details><div class="assess-controls"><button class="action secondary" onclick="moveAssessment('+day+',\''+name+'\',-1)" '+(a.at===0?"disabled":"")+'>← Previous</button><button class="action secondary" onclick="moveAssessment('+day+',\''+name+'\',1)" '+(a.at===49?"disabled":"")+'>Next →</button><button class="action" onclick="finishAssessment('+day+',\''+name+'\')">Submit assessment</button></div></div></div>';
    document.getElementById("assessmentModal").classList.add("show");
    var hint=document.querySelector("#assessmentModal .assess-hint");
    if(hint)hint.addEventListener("toggle",function(){a.hint=hint.open;persist();});
  }
  window.saveAssessmentAnswer=function(day,name,index) {
    var s=phase(day,name),a=s.active,q=bank(day)[a.ids[a.at]];
    a.answers[q.id]=q.options[index];persist();paintAssessment(day,name);
  };
  window.moveAssessment=function(day,name,delta) {
    var a=phase(day,name).active;if(!a)return;a.at=Math.max(0,Math.min(49,a.at+delta));a.hint=false;persist();paintAssessment(day,name);
  };
  window.finishAssessment=function(day,name) {
    var s=phase(day,name),a=s.active;
    if(!a)return;
    if(!assessmentWindowOpen(name)||!portalAllowed(day)){toast("The portal or assessment window has closed. Your answers are saved.");return;}
    if(Object.keys(a.answers).length<50){toast("Answer all 50 questions before submitting.");return;}
    var qs=a.ids.map(function(id){return bank(day)[id];});
    var correct=qs.reduce(function(total,q){return total+(a.answers[q.id]===q.correct?1:0);},0);
    var passed=correct>=35, attempt={score:correct,passed:passed,at:new Date().toISOString()};
    s.attempts.push(attempt);s.passed=s.passed||passed;s.active=null;
    if(s.attempts.length===1)state.xp=(state.xp||0)+correct*(name==="pre"?1:2);
    if(name==="post"&&passed&&state.dayBadges.indexOf(day)<0)state.dayBadges.push(day);
    persist();updateNumbers();if(typeof render==="function")render();
    var remaining=2-s.attempts.length;
    document.getElementById("assessmentModal").innerHTML='<div class="assess-window"><header class="assess-head"><div><div class="eyebrow" style="color:#aebeff">DAY 0'+(day+1)+' · '+name.toUpperCase()+' RESULT</div><h2>Assessment saved</h2><p>'+new Date(attempt.at).toLocaleString()+'</p></div><button class="assess-close" onclick="closeAssessment('+day+')">Close</button></header><div class="assess-result"><div class="score">'+correct+'<span style="font-size:20px;color:#8a93a8"> / 50</span></div><h3>'+(passed?"Strong work — you passed.":"Keep learning and try again.")+'</h3><p>'+(passed?"You reached the 70% pass mark. "+(name==="post"?"Today’s badge and certificate are unlocked.":"Your baseline is recorded."):"You need 35 correct answers to pass. Use the lesson notes and Mentor Kapil’s hints before your retake.")+'</p><p>XP earned: '+(s.attempts.length===1?correct*(name==="pre"?1:2):0)+' · '+remaining+' retake'+(remaining===1?"":"s")+' remaining.</p>'+(remaining>0?'<button class="action" onclick="launchAssessment('+day+',\''+name+'\')">Use retake</button>':"")+'<button class="action secondary" onclick="closeAssessment('+day+')">Return to lesson</button></div></div>';
    document.getElementById("assessmentModal").classList.add("show");
  };
  window.reviewAssessment=function(day,name) {
    var s=phase(day,name),last=s.attempts[s.attempts.length-1];
    if(!last){toast("No submitted assessment to review yet.");return;}
    document.getElementById("assessmentModal").innerHTML='<div class="assess-window"><header class="assess-head"><div><div class="eyebrow" style="color:#aebeff">DAY 0'+(day+1)+' · '+name.toUpperCase()+'</div><h2>Latest assessment result</h2></div><button class="assess-close" onclick="closeAssessment('+day+')">Close</button></header><div class="assess-result"><div class="score">'+last.score+'<span style="font-size:20px;color:#8a93a8"> / 50</span></div><h3>'+(last.passed?"Passed":"Not passed yet")+'</h3><p>'+s.attempts.length+' of 2 attempts used. '+(2-s.attempts.length)+' retake'+(2-s.attempts.length===1?"":"s")+' remaining.</p><button class="action secondary" onclick="closeAssessment('+day+')">Return to lesson</button></div></div>';
    document.getElementById("assessmentModal").classList.add("show");
  };

  window.spinWheel=function(day) { if(!portalAllowed(day)){toast("Portal is closed for maintenance. It opens daily at 8:00 AM.");return;}
    var s=wheelState(day);
    if(s.current!==null){toast("Answer the current wheel question first.");return;}
    var available=s.pool.filter(function(id){return s.seen.indexOf(id)<0;});
    if(!available.length){toast("You completed all 25 wheel questions for today.");return;}
    var id=available[Math.floor(Math.random()*available.length)];
    s.current=id;s.turns++;persist();
    var wheel=document.getElementById("spinWheel");
    var angle=1440+Math.floor(Math.random()*360);
    wheel.style.transform="rotate("+angle+"deg)";
    var btn=document.querySelector(".wheel-spin");if(btn)btn.disabled=true;
    setTimeout(function(){var host=document.getElementById("wheelQuestionHost");if(host)host.innerHTML=wheelQuestion(day);var b=document.querySelector(".wheel-spin");if(b)b.disabled=true;},3650);
  };
  window.submitWheel=function(day) { if(!portalAllowed(day)){toast("Portal is closed for maintenance.");return;}
    var s=wheelState(day),q=s.current===null?null:bank(day)[s.current];
    if(!q)return;
    var selected=document.querySelector('input[name="wheelAnswer"]:checked');
    if(!selected){toast("Choose an answer first.");return;}
    var chosen=q.options[Number(selected.value)],good=chosen===q.correct;
    s.seen.push(s.current);s.answered={id:q.id,good:good};s.current=null;
    if(good)state.xp=(state.xp||0)+5;
    persist();updateNumbers();
    var host=document.getElementById("wheelQuestionHost");
    if(host)host.innerHTML='<div class="wheel-question"><b>'+(good?"Correct — +5 XP.":"Good try — review this hint.")+'</b><p style="font-size:12px;line-height:1.5;color:#58627a;margin:8px 0">Answer: '+escText(q.correct)+'</p><div class="mentor-note">Mentor Kapil’s hint: '+escText(q.hint)+'</div><p style="font-size:11px;color:#7a8498">'+s.seen.length+' of 25 questions completed.</p></div>';
    var btn=document.querySelector(".wheel-spin");if(btn){btn.disabled=s.seen.length>=25;btn.textContent=s.seen.length>=25?"Challenge complete":"Spin for the next question";}
    var count=document.querySelector(".wheel-panel .status");if(count)count.textContent=s.seen.length+" / 25";
  };

  function allPostPassed() { for(var i=0;i<5;i++){if(!phase(i,"post").passed)return false;}return true; }
  function drawCertificate(day) {
    var course=day===-1,canvas=document.createElement("canvas");canvas.width=1800;canvas.height=1273;
    var c=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
    c.fillStyle="#faf8f1";c.fillRect(0,0,w,h);
    c.strokeStyle="#152342";c.lineWidth=17;c.strokeRect(38,38,w-76,h-76);
    c.strokeStyle="#c5a252";c.lineWidth=3;c.strokeRect(60,60,w-120,h-120);
    c.fillStyle="#152342";c.beginPath();c.arc(w/2,188,42,0,Math.PI*2);c.fill();
    c.fillStyle="#f6d783";c.font="42px Georgia";c.textAlign="center";c.fillText("✦",w/2,202);
    c.fillStyle="#a27c2b";c.font="600 22px Arial";c.letterSpacing="5px";c.fillText(course?"CERTIFICATE OF COMPLETION":"DAILY CERTIFICATE",w/2,286);
    c.fillStyle="#172644";c.font="700 52px Georgia";c.letterSpacing="0px";c.fillText(course?"DIGITAL ENABLEMENT":"ENGINEERING FIELD DAY",w/2,371);
    c.fillStyle="#657086";c.font="26px Arial";c.fillText(course?"BASICS FOR ENGINEERS":"DIGITAL ENABLEMENT BASICS FOR ENGINEERS",w/2,421);
    c.fillStyle="#667085";c.font="23px Arial";c.fillText("This certificate is proudly presented to",w/2,515);
    c.fillStyle="#1c345f";c.font="700 58px Georgia";c.fillText(String(state.name||"Learner").toUpperCase(),w/2,606);
    c.strokeStyle="#c5a252";c.lineWidth=2;c.beginPath();c.moveTo(420,638);c.lineTo(1380,638);c.stroke();
    c.fillStyle="#4d596f";c.font="24px Arial";
    var message=course?"for completing the five-day learning journey in modern digital technologies and engineering applications.":"for completing Day "+(day+1)+": "+lessons[day].short+" and demonstrating daily learning through a post-assessment.";
    wrapCanvas(c,message,w/2,704,1180,38);
    var xp=(state.xp||0)+" XP";c.fillStyle="#9a7528";c.font="600 22px Arial";c.fillText((course?"5 DAYS · 15 HOURS":"DAY 0"+(day+1)+" · KNOWLEDGE VERIFIED")+" · "+xp,w/2,865);
    c.fillStyle="#637089";c.font="20px Arial";c.fillText("Issued "+new Date().toLocaleDateString(),w/2,925);
    c.fillStyle="#172644";c.font="600 19px Arial";c.fillText("POWERED BY MENTOR KAPIL  ·  GALGOTIAS UNIVERSITY  ·  L&T EduTech",w/2,1040);
    c.fillStyle="#8992a3";c.font="16px Arial";c.fillText("Digital Enablement Basics for Engineers",w/2,1080);
    return canvas;
  }
  function wrapCanvas(ctx,text,x,y,maxWidth,lineHeight) {
    var words=text.split(" "),line="",lines=[];
    words.forEach(function(word){var test=line?line+" "+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;});
    if(line)lines.push(line);lines.forEach(function(item,i){ctx.fillText(item,x,y+i*lineHeight);});
  }
  function certificateMarkup(day) {
    var course=day===-1,title=course?"Course completion":"Day 0"+(day+1)+" · "+lessons[day].short;
    return '<div class="certificate-card"><div class="cert-seal">✦</div><div class="eyebrow" style="color:#a27c2b">PROFESSIONAL CERTIFICATE</div><h2>'+title+'</h2><p>Presented to</p><div class="recipient">'+escText(state.name)+'</div><p>'+(course?"for completing all five daily post-assessments in Digital Enablement Basics for Engineers.":"for passing the "+lessons[day].short+" post-assessment in Digital Enablement Basics for Engineers.")+'</p><p>Issued '+new Date().toLocaleDateString()+' · '+(state.xp||0)+' XP</p><p><b>Powered by Mentor Kapil</b><br>Galgotias University · L&T EduTech</p><div class="certificate-actions"><button class="action" onclick="downloadCertificate('+day+',\'png\')">Download PNG</button><button class="action secondary" onclick="downloadCertificate('+day+',\'pdf\')">Download PDF</button><button class="action secondary" onclick="closeCertificate()">Close</button></div></div>';
  }
  window.openCertificate=function(day) { if(!portalAllowed(Math.max(0,day))){toast("Portal is closed for maintenance.");return;}
    if(day===-1&&!allPostPassed()){toast("Pass all five post-assessments to unlock the course certificate.");return;}
    if(day>=0&&!phase(day,"post").passed){toast("Pass today’s post-assessment to unlock this certificate.");return;}
    document.getElementById("certificateModal").innerHTML=certificateMarkup(day);
    document.getElementById("certificateModal").classList.add("show");
  };
  window.closeCertificate=function(){document.getElementById("certificateModal").classList.remove("show");};
  window.downloadCertificate=function(day,format) { if(!portalAllowed(Math.max(0,day))){toast("Portal is closed for maintenance.");return;}
    if(day===-1&&!allPostPassed()){toast("Pass all five post-assessments to unlock the course certificate.");return;}
    if(day>=0&&!phase(day,"post").passed){toast("Pass today’s post-assessment to unlock this certificate.");return;}
    var canvas=drawCertificate(day),base=day===-1?"Digital-Enablement-Certificate":"Day-"+(day+1)+"-Certificate";
    if(format==="png"){canvas.toBlob(function(blob){downloadBlob(blob,base+".png");},"image/png");return;}
    var jpeg=canvas.toDataURL("image/jpeg",0.94),binary=atob(jpeg.split(",")[1]),content="q 841.89 0 0 595.28 0 0 cm /Im0 Do Q";
    var objects=[
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /XObject /Subtype /Image /Width 1800 /Height 1273 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+binary.length+" >>\nstream\n"+binary+"\nendstream",
      "<< /Length "+content.length+" >>\nstream\n"+content+"\nendstream"
    ];
    var pdf="%PDF-1.4\n",offsets=[0];
    objects.forEach(function(obj,i){offsets.push(pdf.length);pdf+=(i+1)+" 0 obj\n"+obj+"\nendobj\n";});
    var xref=pdf.length;pdf+="xref\n0 6\n0000000000 65535 f \n";
    for(var i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
    pdf+="trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF";
    var bytes=Uint8Array.from(pdf,function(ch){return ch.charCodeAt(0);});
    downloadBlob(new Blob([bytes],{type:"application/pdf"}),base+".pdf");
  };
  function downloadBlob(blob,name) {
    var url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }
  window.showCertificate=function(){window.openCertificate(-1);};

  window.render=function(){
    if(oldRender)oldRender();
    updateNumbers();
    document.querySelectorAll(".badge").forEach(function(el,i){if((state.dayBadges||[]).indexOf(i)>=0)el.classList.add("earned");});
  };
  ensureState();
  updateNumbers();
  if(PREVIEW)document.documentElement.classList.add("assessment-preview");
  window.setInterval(function(){
    if(document.getElementById("dayview")&&document.getElementById("dayview").classList.contains("show")&&typeof activeDay==="number"&&activeDay>=0&&typeof openDay==="function")openDay(activeDay,true);
  },60000);
})();
