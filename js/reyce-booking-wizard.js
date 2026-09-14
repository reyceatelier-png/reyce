/* REYCE — assistant de réservation (nettoyage avec acompte + demande de projet) */
(function(){
/* Le paiement Stripe (acompte) est mis en pause pour l'instant : le parcours
   se termine par un écran de confirmation local. Le code de paiement reste
   en place, prêt à être réactivé — repasser ce flag à true suffira. */
var STRIPE_ENABLED=false;
var panel=document.getElementById('panel'),stepsEl=document.getElementById('steps'),
asideTitle=document.getElementById('asideTitle'),asideText=document.getElementById('asideText');
if(!panel) return;

/* ============================================================
   GABARITS
   Chaque gabarit a désormais son propre tarif par formule (voir
   CLEAN[...].formules[...].parGabarit) — plus de supplément flat, sauf
   pour "sportive" (véhicules d'exception, non concernés par la nouvelle
   grille), qui reste calculé sur la base citadine + ce supplément.
   ============================================================ */
var GABARITS={
  citadine:{label:'Citadine / compacte', desc:'Citadine, compacte, petite urbaine'},
  berline:{label:'Berline', desc:'Berline, break, coupé'},
  suv:{label:'SUV / crossover', desc:'SUV, crossover, tout-terrain'},
  van:{label:'Grand SUV / 7 places', desc:'Grand SUV, monospace, van, utilitaire'},
  sportive:{label:'Véhicule d\'exception', desc:'Sportive, GT, supercar', supp:60}
};
/* base des modèles les plus courants en France -> gabarit.
   Le client tape, on autocomplète, le gabarit est déduit avec certitude.
   Modèle rare non listé -> il choisit son gabarit à la main (aucun blocage). */
var VDB={
  'Renault':{'Twingo':'citadine','Clio':'citadine','Zoe':'citadine','Modus':'citadine','Wind':'citadine','R5 E-Tech':'citadine','R4 E-Tech':'suv','Captur':'suv','Arkana':'suv','Kadjar':'suv','Koleos':'suv','Austral':'suv','Rafale':'suv','Symbioz':'suv','Megane':'berline','Megane E-Tech':'suv','Fluence':'berline','Laguna':'berline','Talisman':'berline','Safrane':'berline','Latitude':'berline','Vel Satis':'berline','Avantime':'berline','Scenic':'van','Grand Scenic':'van','Scenic E-Tech':'suv','Espace':'van','Kangoo':'van','Grand Kangoo':'van','Trafic':'van','Master':'van','Alpine A110':'sportive'},
  'Peugeot':{'106':'citadine','107':'citadine','108':'citadine','206':'citadine','207':'citadine','208':'citadine','e-208':'citadine','1007':'citadine','2008':'suv','e-2008':'suv','306':'berline','307':'berline','308':'berline','309':'berline','405':'berline','406':'berline','407':'berline','408':'berline','508':'berline','605':'berline','607':'berline','3008':'suv','5008':'van','4007':'suv','4008':'suv','RCZ':'sportive','206 CC':'citadine','207 CC':'citadine','308 CC':'berline','Rifter':'van','Partner':'van','Expert':'van','Traveller':'van','Boxer':'van','iOn':'citadine'},
  'Citroen':{'C1':'citadine','C2':'citadine','C3':'citadine','C3 Aircross':'suv','C4':'berline','C4 X':'berline','C4 Cactus':'suv','C4 Picasso':'van','Grand C4 Picasso':'van','C4 SpaceTourer':'van','C5':'berline','C5 X':'berline','C5 Aircross':'suv','C6':'berline','C8':'van','C15':'van','Xsara':'berline','Xsara Picasso':'van','Picasso':'van','Berlingo':'van','SpaceTourer':'van','Jumpy':'van','Jumper':'van','Nemo':'van','Ami':'citadine','Saxo':'citadine','ZX':'berline','Xantia':'berline','C-Zero':'citadine','C3 Pluriel':'citadine'},
  'DS':{'DS3':'citadine','DS3 Crossback':'suv','DS4':'berline','DS4 Crossback':'suv','DS5':'berline','DS7':'suv','DS7 Crossback':'suv','DS9':'berline','DS N4':'suv','DS N8':'suv'},
  'Volkswagen':{'Up':'citadine','Lupo':'citadine','Fox':'citadine','Polo':'citadine','Golf':'berline','Golf Plus':'van','Golf GTI':'sportive','Golf R':'sportive','ID.3':'berline','Jetta':'berline','Bora':'berline','Vento':'berline','Beetle':'citadine','Coccinelle':'citadine','New Beetle':'citadine','Scirocco':'sportive','Corrado':'sportive','Passat':'berline','Passat CC':'berline','Arteon':'berline','CC':'berline','Phaeton':'berline','T-Cross':'suv','T-Roc':'suv','Taigo':'suv','Tiguan':'suv','Tiguan Allspace':'suv','ID.4':'suv','ID.5':'suv','ID.7':'berline','Touareg':'suv','Tayron':'suv','Touran':'van','Sharan':'van','Caddy':'van','Transporter':'van','Multivan':'van','California':'van','Caravelle':'van','Amarok':'van','ID. Buzz':'van'},
  'Audi':{'A1':'citadine','A2':'citadine','A3':'berline','S3':'berline','RS3':'sportive','A4':'berline','A4 Avant':'berline','S4':'berline','RS4':'sportive','A5':'berline','S5':'berline','RS5':'sportive','A6':'berline','A6 Avant':'berline','S6':'berline','RS6':'sportive','A7':'berline','RS7':'sportive','A8':'berline','Q2':'suv','Q3':'suv','Q3 Sportback':'suv','Q4 e-tron':'suv','Q5':'suv','Q5 Sportback':'suv','SQ5':'suv','Q6 e-tron':'suv','Q7':'suv','Q8':'suv','Q8 e-tron':'suv','RS Q8':'suv','e-tron':'suv','e-tron GT':'sportive','TT':'sportive','TTS':'sportive','TT RS':'sportive','R8':'sportive'},
  'BMW':{'Serie 1':'berline','Serie 2':'berline','Serie 2 Gran Coupe':'berline','Serie 2 Active Tourer':'van','Serie 2 Gran Tourer':'van','Serie 3':'berline','Serie 3 Touring':'berline','Serie 4':'berline','Serie 4 Gran Coupe':'berline','Serie 5':'berline','Serie 5 Touring':'berline','Serie 6':'berline','Serie 6 GT':'berline','Serie 7':'berline','Serie 8':'berline','X1':'suv','X2':'suv','X3':'suv','X3 M':'suv','X4':'suv','X5':'suv','X5 M':'suv','X6':'suv','X6 M':'suv','X7':'suv','XM':'suv','i3':'citadine','i4':'berline','i5':'berline','i7':'berline','iX':'suv','iX1':'suv','iX2':'suv','iX3':'suv','Z3':'sportive','Z4':'sportive','i8':'sportive','M2':'sportive','M3':'sportive','M4':'sportive','M5':'sportive','M6':'sportive','M8':'sportive'},
  'Mercedes':{'Classe A':'berline','Classe B':'van','Classe C':'berline','Classe C Break':'berline','Classe E':'berline','Classe E Break':'berline','Classe S':'berline','CLA':'berline','CLA Shooting Brake':'berline','CLS':'berline','CLC':'berline','CLK':'berline','SLK':'sportive','SLC':'sportive','SL':'sportive','AMG GT':'sportive','SLS':'sportive','GLA':'suv','GLB':'suv','GLC':'suv','GLC Coupe':'suv','GLE':'suv','GLE Coupe':'suv','GLS':'suv','GLK':'suv','ML':'suv','GL':'suv','Classe G':'suv','EQA':'suv','EQB':'suv','EQC':'suv','EQE':'berline','EQE SUV':'suv','EQS':'berline','EQS SUV':'suv','Classe R':'van','Vito':'van','Classe V':'van','Viano':'van','Citan':'van','Sprinter':'van','Classe T':'van'},
  'Tesla':{'Model 3':'berline','Model S':'berline','Model Y':'suv','Model X':'suv','Roadster':'sportive','Cybertruck':'suv'},
  'Toyota':{'Aygo':'citadine','Aygo X':'citadine','iQ':'citadine','Yaris':'citadine','Yaris Cross':'suv','Auris':'berline','Corolla':'berline','Corolla Touring':'berline','Corolla Cross':'suv','Avensis':'berline','Prius':'berline','Prius+':'van','Mirai':'berline','C-HR':'suv','bZ4X':'suv','RAV4':'suv','Highlander':'suv','Land Cruiser':'suv','GR86':'sportive','GT86':'sportive','Supra':'sportive','GR Yaris':'sportive','GR Corolla':'sportive','MR2':'sportive','Celica':'sportive','Camry':'berline','Verso':'van','Verso-S':'van','Proace':'van','Proace City':'van','Proace Verso':'van','Hilux':'van'},
  'Lexus':{'CT':'berline','IS':'berline','ES':'berline','GS':'berline','LS':'berline','UX':'suv','NX':'suv','RX':'suv','RZ':'suv','GX':'suv','LX':'suv','LC':'sportive','RC':'sportive','RC F':'sportive','LBX':'suv'},
  'Ford':{'Ka':'citadine','Ka+':'citadine','Fiesta':'citadine','Fiesta ST':'sportive','Focus':'berline','Focus ST':'sportive','Focus RS':'sportive','Mondeo':'berline','Escort':'berline','Sierra':'berline','Fusion':'van','Puma':'suv','EcoSport':'suv','Kuga':'suv','Edge':'suv','Explorer':'suv','Bronco':'suv','Capri':'suv','Mustang':'sportive','Mustang Mach-E':'suv','GT':'sportive','B-Max':'van','C-Max':'van','Grand C-Max':'van','S-Max':'van','Galaxy':'van','Tourneo':'van','Tourneo Connect':'van','Transit':'van','Transit Custom':'van','Ranger':'van','Ranger Raptor':'van'},
  'Opel':{'Adam':'citadine','Karl':'citadine','Agila':'citadine','Corsa':'citadine','Corsa-e':'citadine','Tigra':'citadine','Astra':'berline','Astra Sports Tourer':'berline','Vectra':'berline','Insignia':'berline','Calibra':'sportive','GT':'sportive','Speedster':'sportive','Mokka':'suv','Mokka-e':'suv','Crossland':'suv','Grandland':'suv','Frontera':'suv','Antara':'suv','Meriva':'van','Zafira':'van','Zafira Life':'van','Combo':'van','Combo Life':'van','Vivaro':'van','Movano':'van'},
  'Fiat':{'500':'citadine','500e':'citadine','500C':'citadine','Panda':'citadine','Punto':'citadine','Grande Punto':'citadine','Punto Evo':'citadine','Seicento':'citadine','Cinquecento':'citadine','Tipo':'berline','Bravo':'berline','Stilo':'berline','Croma':'berline','500X':'suv','600':'suv','500L':'van','Doblo':'van','Multipla':'van','Idea':'van','Ulysse':'van','Ducato':'van','Qubo':'van','Scudo':'van','Talento':'van','Barchetta':'sportive','124 Spider':'sportive','Coupe':'sportive'},
  'Alfa Romeo':{'MiTo':'citadine','Giulietta':'berline','147':'berline','146':'berline','156':'berline','159':'berline','166':'berline','Giulia':'berline','Giulia Quadrifoglio':'sportive','Brera':'sportive','GT':'sportive','GTV':'sportive','Spider':'sportive','8C':'sportive','4C':'sportive','Stelvio':'suv','Stelvio Quadrifoglio':'suv','Tonale':'suv','Junior':'suv'},
  'Lancia':{'Ypsilon':'citadine','Y':'citadine','Delta':'berline','Musa':'van','Phedra':'van','Thema':'berline','Thesis':'berline'},
  'Volvo':{'V40':'berline','V50':'berline','V70':'berline','S40':'berline','S60':'berline','S60 Polestar':'sportive','V60':'berline','V60 Polestar':'sportive','S80':'berline','S90':'berline','V90':'berline','C30':'berline','C70':'sportive','XC40':'suv','EX40':'suv','C40':'suv','EX30':'suv','XC60':'suv','XC70':'suv','XC90':'suv','EX90':'suv'},
  'Polestar':{'Polestar 1':'sportive','Polestar 2':'berline','Polestar 3':'suv','Polestar 4':'suv'},
  'Nissan':{'Micra':'citadine','Note':'citadine','Leaf':'berline','Pulsar':'berline','Almera':'berline','Primera':'berline','Juke':'suv','Qashqai':'suv','Qashqai+2':'van','X-Trail':'suv','Murano':'suv','Ariya':'suv','Terrano':'suv','Pathfinder':'suv','350Z':'sportive','370Z':'sportive','Z':'sportive','GT-R':'sportive','Skyline':'sportive','200SX':'sportive','Townstar':'van','NV200':'van','Primastar':'van','Interstar':'van','Navara':'van'},
  'Infiniti':{'Q30':'berline','Q50':'berline','Q60':'sportive','Q70':'berline','QX30':'suv','QX50':'suv','QX70':'suv'},
  'Hyundai':{'i10':'citadine','i20':'citadine','i20 N':'sportive','i30':'berline','i30 N':'sportive','i40':'berline','Ioniq':'berline','Ioniq 5':'suv','Ioniq 5 N':'sportive','Ioniq 6':'berline','Kona':'suv','Bayon':'suv','Tucson':'suv','Santa Fe':'suv','Nexo':'suv','Getz':'citadine','ix20':'van','ix35':'suv','Veloster':'sportive'},
  'Kia':{'Picanto':'citadine','Rio':'citadine','Ceed':'berline','ProCeed':'berline','Stinger':'sportive','Optima':'berline','Stonic':'suv','Niro':'suv','Soul':'suv','Sportage':'suv','Sorento':'suv','EV3':'suv','EV6':'suv','EV6 GT':'sportive','EV9':'suv','XCeed':'suv','Venga':'van','Carens':'van','Carnival':'van'},
  'Seat':{'Mii':'citadine','Ibiza':'citadine','Ibiza Cupra':'sportive','Leon':'berline','Leon Cupra':'sportive','Toledo':'berline','Cordoba':'berline','Exeo':'berline','Arosa':'citadine','Arona':'suv','Ateca':'suv','Tarraco':'suv','Alhambra':'van','Altea':'van','Altea XL':'van'},
  'Cupra':{'Leon':'berline','Formentor':'suv','Born':'berline','Ateca':'suv','Tavascan':'suv','Terramar':'suv'},
  'Skoda':{'Citigo':'citadine','Fabia':'citadine','Rapid':'berline','Scala':'berline','Octavia':'berline','Octavia RS':'sportive','Superb':'berline','Kamiq':'suv','Karoq':'suv','Kodiaq':'suv','Yeti':'suv','Enyaq':'suv','Elroq':'suv','Roomster':'van','Fabia Combi':'berline'},
  'Dacia':{'Sandero':'citadine','Sandero Stepway':'citadine','Spring':'citadine','Logan':'berline','Logan MCV':'berline','Duster':'suv','Bigster':'suv','Jogger':'van','Lodgy':'van','Dokker':'van'},
  'Mini':{'Cooper':'citadine','One':'citadine','Cooper S':'sportive','John Cooper Works':'sportive','Cooper SE':'citadine','Clubman':'berline','Cabrio':'citadine','Countryman':'suv','Paceman':'suv','Aceman':'suv'},
  'Porsche':{'911':'sportive','911 Turbo':'sportive','911 GT3':'sportive','912':'sportive','718':'sportive','Boxster':'sportive','Cayman':'sportive','924':'sportive','928':'sportive','944':'sportive','968':'sportive','Carrera GT':'sportive','918 Spyder':'sportive','Panamera':'berline','Taycan':'berline','Macan':'suv','Cayenne':'suv','Cayenne Coupe':'suv'},
  'Jaguar':{'XE':'berline','XF':'berline','XJ':'berline','S-Type':'berline','X-Type':'berline','XK':'sportive','XKR':'sportive','F-Type':'sportive','E-Type':'sportive','E-Pace':'suv','F-Pace':'suv','I-Pace':'suv'},
  'Land Rover':{'Defender':'suv','Discovery':'suv','Discovery Sport':'suv','Freelander':'suv','Range Rover':'suv','Range Rover Sport':'suv','Range Rover Evoque':'suv','Range Rover Velar':'suv'},
  'Mazda':{'Mazda2':'citadine','Mazda3':'berline','Mazda5':'van','Mazda6':'berline','MX-30':'suv','CX-3':'suv','CX-30':'suv','CX-5':'suv','CX-60':'suv','CX-7':'suv','CX-80':'suv','MX-5':'sportive','RX-7':'sportive','RX-8':'sportive'},
  'Honda':{'Jazz':'citadine','Civic':'berline','Civic Type R':'sportive','Accord':'berline','Insight':'berline','e':'citadine','e:Ny1':'suv','HR-V':'suv','CR-V':'suv','ZR-V':'suv','CR-Z':'sportive','S2000':'sportive','NSX':'sportive','Integra':'sportive','Prelude':'sportive'},
  'Suzuki':{'Alto':'citadine','Celerio':'citadine','Swift':'citadine','Swift Sport':'sportive','Baleno':'citadine','Ignis':'citadine','Splash':'citadine','Wagon R':'citadine','Swace':'berline','Vitara':'suv','Grand Vitara':'suv','S-Cross':'suv','Jimny':'suv','SX4':'suv','Across':'suv'},
  'Mitsubishi':{'Space Star':'citadine','Colt':'citadine','Lancer':'berline','Lancer Evo':'sportive','Carisma':'berline','ASX':'suv','Eclipse Cross':'suv','Outlander':'suv','Outlander PHEV':'suv','Pajero':'suv','Shogun':'suv','L200':'van','Grandis':'van','Space Wagon':'van'},
  'Jeep':{'Renegade':'suv','Compass':'suv','Avenger':'suv','Cherokee':'suv','Grand Cherokee':'suv','Wrangler':'suv','Commander':'suv','Patriot':'suv','Gladiator':'van'},
  'Dodge':{'Challenger':'sportive','Charger':'sportive','Viper':'sportive','Durango':'suv','Journey':'suv','Nitro':'suv','RAM 1500':'van','Caliber':'berline','Avenger':'berline'},
  'Chrysler':{'300C':'berline','PT Cruiser':'van','Voyager':'van','Grand Voyager':'van','Crossfire':'sportive','Sebring':'berline'},
  'Cadillac':{'CTS':'berline','ATS':'berline','Escalade':'suv','XT4':'suv','XT5':'suv','SRX':'suv','BLS':'berline','Lyriq':'suv'},
  'Chevrolet':{'Spark':'citadine','Matiz':'citadine','Aveo':'citadine','Kalos':'citadine','Cruze':'berline','Lacetti':'berline','Camaro':'sportive','Corvette':'sportive','Captiva':'suv','Trax':'suv','Orlando':'van','Volt':'berline'},
  'Abarth':{'500':'sportive','595':'sportive','695':'sportive','500e':'sportive','124 Spider':'sportive','Punto':'sportive'},
  'Alpine':{'A110':'sportive','A110 S':'sportive','A290':'sportive','A310':'sportive','GTA':'sportive'},
  'Lotus':{'Elise':'sportive','Exige':'sportive','Evora':'sportive','Emira':'sportive','Evija':'sportive','Eletre':'suv'},
  'Smart':{'Fortwo':'citadine','Forfour':'citadine','Roadster':'sportive','#1':'suv','#3':'suv','Crossblade':'sportive'},
  'MG':{'MG3':'citadine','MG4':'berline','MG4 XPower':'sportive','MG5':'berline','ZS':'suv','HS':'suv','EHS':'suv','Marvel R':'suv','Cyberster':'sportive','ZR':'citadine','TF':'sportive'},
  'BYD':{'Dolphin':'citadine','Atto 2':'suv','Atto 3':'suv','Seal':'berline','Seal U':'suv','Han':'berline','Tang':'suv','Seagull':'citadine','Sealion 7':'suv'},
  'Subaru':{'Impreza':'berline','Impreza WRX':'sportive','WRX STI':'sportive','Legacy':'berline','BRZ':'sportive','XV':'suv','Crosstrek':'suv','Forester':'suv','Outback':'suv','Solterra':'suv','Levorg':'berline'},
  'SsangYong':{'Tivoli':'suv','Korando':'suv','Rexton':'suv','Rodius':'van','Musso':'van','Torres':'suv'},
  'Isuzu':{'D-Max':'van','Trooper':'suv'},
  'Genesis':{'G70':'berline','G80':'berline','G90':'berline','GV60':'suv','GV70':'suv','GV80':'suv'},
  'Saab':{'9-3':'berline','9-5':'berline','9-3 Cabriolet':'sportive','900':'berline','9000':'berline'},
  'Lada':{'Niva':'suv','Vesta':'berline','Granta':'berline','4x4':'suv'},
  'Ferrari':{'Roma':'sportive','Portofino':'sportive','California':'sportive','F8 Tributo':'sportive','488':'sportive','458 Italia':'sportive','F430':'sportive','360 Modena':'sportive','296 GTB':'sportive','812 Superfast':'sportive','SF90':'sportive','FF':'sportive','GTC4Lusso':'sportive','Purosangue':'suv','LaFerrari':'sportive','599':'sportive','612':'sportive','F12':'sportive','Enzo':'sportive'},
  'Lamborghini':{'Huracan':'sportive','Gallardo':'sportive','Aventador':'sportive','Murcielago':'sportive','Revuelto':'sportive','Diablo':'sportive','Countach':'sportive','Urus':'suv'},
  'McLaren':{'540C':'sportive','570S':'sportive','600LT':'sportive','650S':'sportive','675LT':'sportive','720S':'sportive','765LT':'sportive','Artura':'sportive','GT':'sportive','P1':'sportive','12C':'sportive'},
  'Aston Martin':{'Vantage':'sportive','V8 Vantage':'sportive','DB7':'sportive','DB9':'sportive','DB11':'sportive','DB12':'sportive','DBS':'sportive','Vanquish':'sportive','Rapide':'berline','Virage':'sportive','DBX':'suv','Valkyrie':'sportive'},
  'Bentley':{'Continental':'berline','Continental GT':'sportive','Flying Spur':'berline','Mulsanne':'berline','Arnage':'berline','Azure':'sportive','Bentayga':'suv'},
  'Rolls-Royce':{'Ghost':'berline','Phantom':'berline','Wraith':'sportive','Dawn':'sportive','Spectre':'sportive','Cullinan':'suv','Silver Shadow':'berline'},
  'Maserati':{'Ghibli':'berline','Quattroporte':'berline','GranTurismo':'sportive','GranCabrio':'sportive','MC20':'sportive','3200 GT':'sportive','Coupe':'sportive','Levante':'suv','Grecale':'suv'},
  'Bugatti':{'Veyron':'sportive','Chiron':'sportive','Divo':'sportive','Tourbillon':'sportive'},
  'Koenigsegg':{'Regera':'sportive','Jesko':'sportive','Agera':'sportive'},
  'Hummer':{'H1':'suv','H2':'suv','H3':'suv'},
  'RAM':{'1500':'van','2500':'van'}
};
/* liste plate "Marque Modèle" pour l'autocomplétion */
var VLIST=[];
for(var mk in VDB){for(var md in VDB[mk]){VLIST.push({marque:mk,modele:md,gab:VDB[mk][md],full:mk+' '+md});}}
function norm(s){return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');}
function detectGab(marque,modele){
  var mkq=(marque||'').trim(), mdq=(modele||'').trim();
  if(VDB[mkq]&&VDB[mkq][mdq])return VDB[mkq][mdq];
  var nmk=norm(mkq),nmd=norm(mdq);
  for(var i=0;i<VLIST.length;i++){if(norm(VLIST[i].marque)===nmk&&norm(VLIST[i].modele)===nmd)return VLIST[i].gab;}
  return null;
}

/* Recherche véhicule unifiée : le client tape librement « BMW X3 M »,
   « x3 m », « cayenne »… On classe les correspondances sur la liste plate
   déjà construite à partir de VDB — une seule base véhicule, qui renvoie
   toujours vers les gabarits tarifaires existants. */
function searchVehicles(q,limit){
  var nq=norm(q);
  if(nq.length<2) return [];
  var out=[];
  for(var i=0;i<VLIST.length;i++){
    var v=VLIST[i], nf=norm(v.full), nm=norm(v.modele);
    var sc=-1;
    if(nf===nq) sc=0;
    else if(nm===nq) sc=1;
    else if(nf.indexOf(nq)===0) sc=2;
    else if(nm.indexOf(nq)===0) sc=3;
    else if(nf.indexOf(nq)>-1) sc=4;
    if(sc>-1) out.push({v:v,sc:sc});
  }
  out.sort(function(a,b){return a.sc-b.sc || a.v.full.length-b.v.full.length;});
  return out.slice(0,limit||7).map(function(o){return o.v;});
}

/* Modèle non reconnu : on ne devine jamais silencieusement. Le client
   choisit son gabarit, et la saisie est journalisée côté serveur pour
   enrichir la base véhicule plus tard (aucune donnée personnelle). */
function logUnknownVehicle(query,chosenGab){
  if(!query||!query.trim()) return;
  try{
    fetch('/api/vehicle-unknown',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({query:query.trim().slice(0,120), category:chosenGab||null})
    }).catch(function(){});
  }catch(e){}
}

/* ============================================================
   TARIFS — formule × type de nettoyage
   Ces identifiants correspondent aux prestations définies côté
   serveur (server.js) pour la création de la session Stripe.
   ============================================================ */
/* Sous-titre de palier — identique quel que soit le type de nettoyage :
   il doit rendre la montée en gamme compréhensible en quelques secondes. */
var TIER_SUB={Confort:'Entretien', Premium:'Nettoyage approfondi', 'Expérience':'Remise à neuf complète'};

var CLEAN={
  interieur:{label:'Intérieur', svc:'int', formules:[
    {k:'Confort', nom:'Confort', prix:69, parGabarit:{citadine:69,berline:79,suv:89,van:99},
      pitch:'Idéale pour l\'entretien régulier d\'un véhicule déjà correctement entretenu.',
      highlights:['Aspiration en surface de l\'habitacle et des tapis','Dépoussiérage des plastiques et surfaces intérieures','Nettoyage des vitres intérieures'],
      detail:['Aspiration en surface de l\'habitacle','Aspiration des tapis','Dépoussiérage des plastiques et surfaces intérieures','Nettoyage léger des surfaces accessibles','Nettoyage des vitres intérieures'],
      outro:'Une prestation essentielle pour conserver votre véhicule propre au quotidien.'},
    {k:'Premium', nom:'Premium', prix:129, parGabarit:{citadine:129,berline:149,suv:169,van:189}, reco:true,
      pitch:'Un nettoyage intérieur approfondi pour retrouver un habitacle parfaitement propre.',
      highlights:['Aspiration approfondie de l\'habitacle, tapis et moquettes','Shampooing des sièges tissu ou dégraissage des sièges cuir','Nettoyage approfondi des plastiques et de la console','Parfum intérieur REYCE'],
      detail:['Aspiration approfondie de l\'habitacle','Aspiration des moquettes','Aspiration et nettoyage des tapis','Shampooing des sièges en tissu, ou nettoyage et dégraissage des sièges en cuir selon le véhicule','Nettoyage approfondi des plastiques','Nettoyage de la console centrale','Nettoyage des surfaces intérieures','Nettoyage des entrants de portes','Nettoyage des vitres intérieures','Désodorisation de l\'habitacle','Parfum intérieur REYCE'],
      outro:'Idéale pour une remise au propre approfondie de l\'intérieur.'},
    {k:'Expérience', nom:'Expérience', prix:219, parGabarit:{citadine:219,berline:249,suv:279,van:309}, top:true, deep:true,
      pitch:'L\'Expérience REYCE va au-delà du nettoyage traditionnel : chaque zone de l\'habitacle est travaillée en profondeur.',
      highlights:['Aspiration complète, y compris sous les sièges et zones difficiles d\'accès','Shampooing en profondeur des sièges, moquettes et tapis','Cuirs dégraissés, nettoyés, nourris et protégés','Traitement à l\'ozone — neutralise durablement les mauvaises odeurs'],
      detail:['Aspiration complète et en profondeur','Aspiration sous les sièges et dans les zones difficiles d\'accès','Shampooing en profondeur des sièges en tissu','Shampooing des moquettes','Nettoyage et shampooing en profondeur des tapis','Nettoyage des rails et contours de sièges','Nettoyage des ceintures de sécurité','Nettoyage du plafonnier','Nettoyage approfondi des plastiques','Nettoyage de la console centrale','Nettoyage des aérateurs, boutons et commandes','Nettoyage approfondi des entrants et seuils de portes','Nettoyage des vitres et miroirs intérieurs','Pour les intérieurs cuir : dégraissage, nettoyage approfondi, nourrissage et protection','Finition et protection des plastiques intérieurs','Désodorisation complète et traitement à l\'ozone','Parfum intérieur et finition REYCE']}
  ]},
  exterieur:{label:'Extérieur', svc:'ext', formules:[
    {k:'Confort', nom:'Confort', prix:59, parGabarit:{citadine:59,berline:69,suv:79,van:89},
      pitch:'Idéale pour l\'entretien régulier d\'un véhicule déjà correctement entretenu.',
      highlights:['Prélavage au canon à mousse','Shampooing extérieur et rinçage complet','Nettoyage des jantes en surface et séchage soigné'],
      detail:['Prélavage au canon à mousse','Shampooing extérieur','Rinçage complet','Nettoyage des jantes en surface','Nettoyage des vitres extérieures','Séchage soigné'],
      outro:'Une prestation essentielle pour conserver votre véhicule propre au quotidien.'},
    {k:'Premium', nom:'Premium', prix:109, parGabarit:{citadine:109,berline:119,suv:139,van:159}, reco:true,
      pitch:'Un lavage extérieur approfondi pour une carrosserie parfaitement propre.',
      highlights:['Lavage manuel au gant et shampooing extérieur','Nettoyage complet des jantes et des pneus','Shampooing lustrant — une finition qui apporte de la brillance'],
      detail:['Prélavage au canon à mousse','Lavage manuel au gant','Shampooing extérieur','Nettoyage complet des jantes','Nettoyage des pneus','Finition et dressing pneus','Shampooing lustrant — une finition rapide qui apporte davantage de brillance à la carrosserie','Nettoyage des vitres extérieures','Séchage soigné'],
      outro:'Idéale pour une remise au propre approfondie de l\'extérieur.'},
    {k:'Expérience', nom:'Expérience', prix:179, parGabarit:{citadine:179,berline:199,suv:219,van:239}, top:true, deep:true,
      pitch:'L\'Expérience REYCE va au-delà du nettoyage traditionnel : chaque zone de la carrosserie est travaillée en profondeur.',
      highlights:['Lavage manuel minutieux et jantes travaillées en profondeur','Passages de roues, garde-boues et recoins difficiles d\'accès traités','Dressing premium pneus, plastiques et passages de roues','Cire premium appliquée à la main, effet hydrophobe'],
      detail:['Prélavage complet au canon à mousse','Lavage manuel minutieux au gant','Shampooing extérieur premium','Nettoyage en profondeur des jantes et des pneus','Nettoyage des passages de roues et des garde-boues','Nettoyage des recoins et zones difficiles d\'accès','Nettoyage des contours, joints et détails extérieurs','Nettoyage complet des vitres','Dressing premium des pneus, plastiques extérieurs et passages de roues','Finitions détaillées de la carrosserie','Protection carrosserie : application à la main d\'une cire premium','Brillance et profondeur renforcées, effet hydrophobe pouvant durer environ 6 à 12 mois selon l\'usage, l\'entretien du véhicule et les conditions extérieures']}
  ]},
  duo:{label:'Intérieur + Extérieur', svc:'duo', formules:[
    {k:'Confort', nom:'Confort', prix:99, parGabarit:{citadine:99,berline:119,suv:139,van:159},
      pitch:'Idéale pour l\'entretien régulier d\'un véhicule déjà correctement entretenu.',
      highlights:['Aspiration en surface de l\'habitacle et des tapis','Prélavage au canon à mousse et shampooing extérieur','Nettoyage des vitres, intérieur et extérieur'],
      detailInt:['Aspiration en surface de l\'habitacle','Aspiration des tapis','Dépoussiérage des plastiques et surfaces intérieures','Nettoyage léger des surfaces accessibles','Nettoyage des vitres intérieures'],
      detailExt:['Prélavage au canon à mousse','Shampooing extérieur','Rinçage complet','Nettoyage des jantes en surface','Nettoyage des vitres extérieures','Séchage soigné'],
      outro:'Une prestation essentielle pour conserver votre véhicule propre au quotidien.'},
    {k:'Premium', nom:'Premium', prix:199, parGabarit:{citadine:199,berline:219,suv:249,van:279}, reco:true,
      pitch:'Un nettoyage intérieur et extérieur approfondi pour retrouver un véhicule parfaitement propre.',
      highlights:['Aspiration approfondie de l\'habitacle, tapis et moquettes','Shampooing sièges tissu ou dégraissage cuir','Lavage manuel au gant, jantes et pneus nettoyés en profondeur','Shampooing lustrant apportant davantage de brillance','Parfum intérieur REYCE'],
      detailInt:['Aspiration approfondie de l\'habitacle','Aspiration des moquettes','Aspiration et nettoyage des tapis','Shampooing des sièges en tissu, ou nettoyage et dégraissage des sièges en cuir selon le véhicule','Nettoyage approfondi des plastiques','Nettoyage de la console centrale','Nettoyage des surfaces intérieures','Nettoyage des entrants de portes','Nettoyage des vitres intérieures','Désodorisation de l\'habitacle','Parfum intérieur REYCE'],
      detailExt:['Prélavage au canon à mousse','Lavage manuel au gant','Shampooing extérieur','Nettoyage complet des jantes','Nettoyage des pneus','Finition et dressing pneus','Shampooing lustrant — une finition rapide qui apporte davantage de brillance à la carrosserie','Nettoyage des vitres extérieures','Séchage soigné'],
      outro:'Idéale pour une remise au propre approfondie de l\'intérieur comme de l\'extérieur.'},
    {k:'Expérience', nom:'Expérience', prix:349, parGabarit:{citadine:349,berline:389,suv:429,van:469}, top:true, deep:true,
      pitch:'L\'Expérience REYCE va au-delà du nettoyage traditionnel. Chaque partie du véhicule est travaillée en profondeur afin de retrouver un niveau de propreté, de finition et de protection exceptionnel.',
      highlights:['Detailing complet de l\'habitacle, jusque dans les moindres recoins','Cuirs dégraissés, nettoyés, nourris et protégés','Traitement à l\'ozone — neutralise durablement les mauvaises odeurs','Lavage manuel minutieux et jantes travaillées en profondeur','Cire premium appliquée à la main, effet hydrophobe'],
      detailInt:['Aspiration complète et en profondeur','Aspiration sous les sièges et dans les zones difficiles d\'accès','Shampooing en profondeur des sièges en tissu','Shampooing des moquettes','Nettoyage et shampooing en profondeur des tapis','Nettoyage des rails et contours de sièges','Nettoyage des ceintures de sécurité','Nettoyage du plafonnier','Nettoyage approfondi des plastiques','Nettoyage de la console centrale','Nettoyage des aérateurs, boutons et commandes','Nettoyage approfondi des entrants et seuils de portes','Nettoyage des vitres et miroirs intérieurs','Pour les intérieurs cuir : dégraissage, nettoyage approfondi, nourrissage et protection','Finition et protection des plastiques intérieurs','Désodorisation complète et traitement à l\'ozone','Parfum intérieur et finition REYCE'],
      detailExt:['Prélavage complet au canon à mousse','Lavage manuel minutieux au gant','Shampooing extérieur premium','Nettoyage en profondeur des jantes et des pneus','Nettoyage des passages de roues et des garde-boues','Nettoyage des recoins et zones difficiles d\'accès','Nettoyage des contours, joints et détails extérieurs','Nettoyage complet des vitres','Dressing premium des pneus, plastiques extérieurs et passages de roues','Finitions détaillées de la carrosserie','Protection carrosserie : application à la main d\'une cire premium','Brillance et profondeur renforcées, effet hydrophobe pouvant durer environ 6 à 12 mois selon l\'usage, l\'entretien du véhicule et les conditions extérieures'],
      outro:'La formule pensée pour une véritable remise à neuf, ou pour le niveau de finition le plus complet proposé par REYCE.'}
  ]}
};

/* ============================================================
   OPTIONS / SUPPLÉMENTS AU CHOIX
   Tarifs "à partir de" : le montant réel dépend de l'état du
   véhicule, de la surface à traiter et du temps nécessaire.
   ============================================================ */
var OPTIONS=[
  {id:'poils', nom:'Poils d\'animaux', desc:'Traitement spécifique sièges & moquettes', prix:30, variable:true},
  {id:'taches', nom:'Taches incrustées', desc:'Détachage en profondeur des salissures tenaces', prix:30, variable:true},
  {id:'ozone', nom:'Désinfection / traitement ozone', desc:'Neutralise durablement les mauvaises odeurs (tabac, animaux)', prix:50},
  {id:'cuir', nom:'Rénovation cuir', desc:'Nettoyage, nourrissage et soin approfondi des cuirs', prix:60},
  {id:'phares', nom:'Rénovation des optiques', desc:'Polissage des phares ternis ou jaunis', prix:80},
  {id:'hydro', nom:'Protection hydrophobe vitres', desc:'Effet déperlant longue durée sur les vitrages', prix:80}
];
var OPTS_VARIABLE_NOTE='Le tarif peut évoluer selon la quantité, l\'état et le temps de traitement nécessaire.';

/* Ne pas reproposer en option payante ce qui est déjà inclus dans la formule
   choisie : l'Expérience (intérieur ou complet) inclut déjà un traitement à
   l'ozone dans son descriptif — inutile de le refaire payer une deuxième fois. */
function visibleOptions(){
  var f=CLEAN[state.clean]&&CLEAN[state.clean].formules[state.form];
  /* L'Expérience intérieure/complète inclut déjà, dans son descriptif, le
     traitement à l'ozone ET le soin complet des cuirs (dégraissage,
     nettoyage, nourrissage, protection) : ces deux options ne doivent pas
     être refacturées par-dessus. Règle reproduite côté serveur. */
  var deepInt=f&&f.k==='Expérience'&&(state.clean==='interieur'||state.clean==='duo');
  var included=deepInt?['ozone','cuir']:[];
  return OPTIONS.filter(function(op){return included.indexOf(op.id)===-1;});
}

/* ============================================================
   CAR STAGING — upsell discret vers la remise à neuf en 1 journée
   Prestation sur devis : pas de réservation/paiement direct ici,
   on redirige vers le flux "projet" déjà existant (demande + rappel).
   ============================================================ */
var STAGING={
  prix:600,
  kicker:'Car Staging',
  titre:'Remise à neuf en 1 journée',
  hookPremium:'Vous souhaitez aller plus loin ?',
  hookExperience:'Pour une remise à neuf encore plus poussée, découvrez notre Car Staging.',
  lead:'Confiez-nous votre véhicule pendant une journée complète. Intérieur, carrosserie, finitions et protection : nous établissons un programme personnalisé afin de le remettre au meilleur niveau possible.',
  ceramique:'Vous recherchez une protection encore plus durable ? Nos traitements céramiques peuvent être intégrés à une préparation personnalisée après échange avec un technicien.'
};

/* Code promo — réservé aux formules Premium & Expérience */
var PROMO={active:true, code:'BIENVENUE10', rate:0.10, until:'31 août 2026', formules:['Premium','Expérience']};

/* ============================================================
   QUESTIONNAIRE « CONSEILLEZ-MOI »
   Il ne connaît AUCUN prix : il ne produit qu'un triplet
   (gabarit déjà choisi à l'étape 1) + formule + type de prestation,
   qui repasse ensuite par priceFor() — le moteur tarifaire unique,
   également utilisé par le parcours direct, l'admin et les emails.
   ============================================================ */
var QUIZ=[
  {key:'goal', q:'Que souhaitez-vous retrouver ?', opts:[
    ['entretenir','Entretenir mon véhicule','Il est déjà correctement entretenu.'],
    ['profondeur','Nettoyer en profondeur','L\'intérieur ou l\'extérieur nécessite davantage de travail.'],
    ['neuf','Le remettre au meilleur niveau','Je recherche une remise à neuf plus poussée.'],
    ['inconnu','Je ne sais pas','Guidez-moi.']]},
  {key:'area', q:'Quelle partie souhaitez-vous traiter ?', opts:[
    ['interieur','Intérieur','Habitacle, sièges, plastiques, vitres.'],
    ['exterieur','Extérieur','Carrosserie, jantes, vitres, finition.'],
    ['duo','Intérieur + Extérieur','Le véhicule repris dans son ensemble.','Recommandé']]},
  {key:'etat', q:'Comment décririez-vous l\'état actuel de votre véhicule ?', opts:[
    ['entretenu','Entretenu','Poussière et traces d\'utilisation normale.'],
    ['reprendre','À reprendre','Salissures visibles, tapis ou surfaces marqués.'],
    ['marque','Très marqué','Taches, odeurs, poils ou salissures importantes.']]},
  {key:'intFlags', q:'Votre intérieur présente-t-il l\'un de ces éléments ?', multi:true, when:'int', opts:[
    ['poils','Poils d\'animaux',''],
    ['taches','Taches incrustées',''],
    ['odeurs','Odeurs persistantes',''],
    ['cuir','Sellerie cuir',''],
    ['aucun','Aucun','']]},
  {key:'extFlags', q:'Que souhaitez-vous améliorer à l\'extérieur ?', multi:true, when:'ext', opts:[
    ['entretien','Entretien courant',''],
    ['brillance','Brillance',''],
    ['jantes','Jantes / pneus',''],
    ['terne','Carrosserie terne',''],
    ['rayures','Micro-rayures',''],
    ['protection','Protection','']]}
];
/* Questions réellement posées : les deux dernières dépendent de la zone
   choisie en question 2 (intérieur / extérieur / complet). */
function quizSteps(){
  var area=state.quiz.area;
  return QUIZ.filter(function(s){
    if(s.when==='int') return area==='interieur'||area==='duo';
    if(s.when==='ext') return area==='exterieur'||area==='duo';
    return true;
  });
}
/* Recommandation : renvoie uniquement { clean, form, why[] }.
   Aucun montant n'est calculé ici. */
function computeReco(){
  /* Barème volontairement prudent : on ne recommande l'Expérience que
     lorsque plusieurs signaux forts convergent. Sur-recommander coûte la
     confiance du client — un besoin courant doit tomber sur Premium. */
  var q=state.quiz, score=0;
  if(q.goal==='profondeur') score=1;
  else if(q.goal==='neuf') score=2;
  else if(q.goal==='inconnu') score=0.5; // laisse l'état trancher
  else score=0;                          // « entretenir »
  if(q.etat==='reprendre') score+=0.5;
  else if(q.etat==='marque') score+=1.5;
  var fi=q.intFlags||[], fe=q.extFlags||[];
  if(fi.indexOf('odeurs')>-1) score+=1;   // seule l'Expérience inclut l'ozone
  if(fi.indexOf('poils')>-1) score+=0.25;
  if(fi.indexOf('taches')>-1) score+=0.25;
  if(fe.indexOf('terne')>-1) score+=0.5;
  if(fe.indexOf('rayures')>-1) score+=0.5;
  var idx=score>=2?2:(score>=1?1:0);
  /* On ne pousse jamais au-delà du Premium un client qui a explicitement
     demandé un simple entretien. */
  if(q.goal==='entretenir') idx=Math.min(idx,1);
  var why=[];
  if(q.goal==='entretenir') why.push('Vous recherchez avant tout un entretien régulier.');
  else if(q.goal==='profondeur') why.push('Vous souhaitez un nettoyage nettement plus poussé qu\'un entretien courant.');
  else if(q.goal==='neuf') why.push('Vous visez une remise à niveau complète du véhicule.');
  else why.push('Nous nous sommes appuyés sur l\'état décrit pour vous orienter.');
  if(q.etat==='entretenu') why.push('Votre véhicule est déjà correctement entretenu.');
  else if(q.etat==='reprendre') why.push('Les salissures visibles demandent un traitement plus approfondi.');
  else if(q.etat==='marque') why.push('L\'état décrit nécessite un travail en profondeur, zone par zone.');
  if(fi.indexOf('odeurs')>-1) why.push('Les odeurs persistantes nécessitent une désodorisation en profondeur.');
  else if(fi.indexOf('poils')>-1) why.push('Les poils d\'animaux demandent un traitement spécifique des textiles.');
  else if(fi.indexOf('cuir')>-1) why.push('Votre sellerie cuir demande un soin adapté.');
  else if(fe.indexOf('terne')>-1||fe.indexOf('rayures')>-1) why.push('L\'état de la carrosserie mérite une finition plus poussée.');
  return {clean:q.area||'duo', form:idx, why:why.slice(0,3)};
}
/* Les réponses du questionnaire pré-sélectionnent les options cohérentes —
   jamais celles déjà incluses dans la formule recommandée. */
function optsFromQuiz(){
  var fi=state.quiz.intFlags||[], fe=state.quiz.extFlags||[], picked=[];
  if(fi.indexOf('poils')>-1) picked.push('poils');
  if(fi.indexOf('taches')>-1) picked.push('taches');
  if(fi.indexOf('odeurs')>-1) picked.push('ozone');
  if(fi.indexOf('cuir')>-1) picked.push('cuir');
  if(fe.indexOf('protection')>-1) picked.push('hydro');
  var vis=visibleOptions().map(function(o){return o.id;});
  return picked.filter(function(id){return vis.indexOf(id)>-1;});
}
/* Fin du questionnaire : on applique le triplet recommandé au state
   commun (gabarit déjà connu + prestation + formule). À partir d'ici, le
   parcours guidé et le parcours direct sont strictement identiques. */
function finishQuiz(){
  var r=computeReco();
  state.reco=r;
  state.clean=r.clean;
  state.form=r.form;
  state.opts=optsFromQuiz();
  pushEvt({event:'recommendation_complete', formula:CLEAN[r.clean].formules[r.form].k,
           service_area:r.clean, vehicle_type:state.gab,
           value:priceFor(r.clean,r.form,state.gab), currency:'EUR'});
}

/* Le Car Staging n'est proposé que lorsque le besoin exprimé le justifie. */
function stagingRelevant(){
  var q=state.quiz, fe=q.extFlags||[];
  return state.form===2 || q.goal==='neuf' || q.etat==='marque' ||
         fe.indexOf('terne')>-1 || fe.indexOf('rayures')>-1;
}

/* ============================================================
   TRACKING GOOGLE ADS / GTM / GA4
   Micro-conversions à chaque étape clé + conversion principale
   booking_complete, déclenchée uniquement après confirmation réelle
   côté serveur (jamais au simple clic ou à l'affichage du formulaire).
   ============================================================ */
window.dataLayer=window.dataLayer||[];
function pushEvt(o){try{window.dataLayer.push(o);}catch(e){}}
var _bookingStarted=false;
function trackBookingStart(){
  if(_bookingStarted)return;_bookingStarted=true;
  pushEvt({event:'booking_start', booking_type:state.type});
}

/* UTM / gclid — capturés à l'arrivée, transmis à la page de remerciement
   et ajoutés aux notes de réservation pour l'attribution côté admin. */
var UTM_KEYS=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid'];
var UTM_PARAMS=(function(){
  var sp=new URLSearchParams(location.search),out={};
  UTM_KEYS.forEach(function(k){var v=sp.get(k);if(v)out[k]=v;});
  return out;
})();
function utmQueryString(){
  var sp=new URLSearchParams();
  UTM_KEYS.forEach(function(k){if(UTM_PARAMS[k])sp.set(k,UTM_PARAMS[k]);});
  return sp.toString();
}
function utmNoteLine(){
  var keys=Object.keys(UTM_PARAMS);
  if(!keys.length)return null;
  return 'Source : '+keys.map(function(k){return k+'='+UTM_PARAMS[k];}).join(' · ');
}

function euro(n){return n>0?(n+'<span class="eur">€</span>'):'___<span class="eur">€</span>';}
function euroTxt(n){return n>0?(n+' €'):'___ €';}
function duoSave(idx){
  var i=priceFor('interieur',idx,state.gab), e=priceFor('exterieur',idx,state.gab), d=priceFor('duo',idx,state.gab);
  if(i>0&&e>0&&d>0) return {sep:i+e, duo:d, save:(i+e-d)};
  return null;
}

var times=['09:00','10:30','13:00','14:30','16:00','17:30'];
var projets=[
  {label:'PPF (protection peinture)', img:'assets/img/30644946.jpg'},
  {label:'Covering / Wrap', img:'assets/img/8664307.jpg'},
  {label:'Vitres teintées', img:'assets/img/22737744.jpg'},
  {label:'Customisation', img:'assets/img/32726106.jpg'},
  {label:'Ligne d\'échappement', img:'assets/img/6872609.jpg'},
  {label:'Car Staging (remise à neuf en 1 journée)', img:'assets/img/30674495.jpg'},
  {label:'Traitement céramique', img:'assets/img/3892898.jpg'},
  {label:'Autre projet', img:'assets/img/20042048.jpg'}
];
var STAGING_PROJ_IDX=projets.findIndex(function(p){return p.label.indexOf('Car Staging')===0;});
var CERAMIQUE_PROJ_IDX=projets.findIndex(function(p){return p.label==='Traitement céramique';});

/* Bascule vers le flux "projet" avec la prestation pré-sélectionnée —
   réutilise entièrement le parcours de demande existant (pas de nouveau
   système : véhicule, échange, coordonnées, envoi via /api/contact). */
function goToProjet(idx){
  state.type='projet';state.projet=[idx];step=0;
  document.querySelectorAll('#rtype button').forEach(function(x){x.classList.toggle('sel', x.dataset.type==='projet');});
  render();
}
var contactModes=['Par téléphone','En visio','À l\'atelier'];
var LAB={
  prestation:['Véhicule','Besoin','Soin','Options','Créneau'],
  projet:['Projet','Véhicule','Échange','Coordonnées']
};

var today=new Date();
function freshState(type){
  return {type:type||'prestation',clean:'duo',form:1,marque:'',modele:'',gab:null,gabAuto:false,manualGab:false,
          vehQuery:'',vehUnknown:false,need:null,quizIdx:0,quiz:{},reco:null,
          opts:[],promo:false,
          calYear:today.getFullYear(),calMonth:today.getMonth(),jourISO:null,jourLabel:null,heure:null,
          projet:[],photos:[],mode:null,prenom:'',nomFam:'',nom:'',tel:'',email:'',msg:''};
}
var state=freshState('prestation');
var step=0;
var MONTHS_FR=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

document.querySelectorAll('#rtype button').forEach(function(b){b.addEventListener('click',function(){
  document.querySelectorAll('#rtype button').forEach(function(x){x.classList.remove('sel');});b.classList.add('sel');
  state.type=b.dataset.type;step=0;trackBookingStart();render();})});

/* booking_start : première interaction réelle avec le tunnel, quel que
   soit l'endroit où elle a lieu (sélecteur de formule ou panneau du bas). */
document.addEventListener('click',function(e){
  if(!_bookingStarted && e.target.closest('#rtype, .resa')) trackBookingStart();
},true);

/* click_phone : tout lien tel: cliqué sur la page (hero, sticky, aside). */
document.addEventListener('click',function(e){
  var a=e.target.closest('a[href^="tel:"]');
  if(a) pushEvt({event:'click_phone', booking_type:state.type});
},true);

function renderSteps(){var L=LAB[state.type];stepsEl.innerHTML='';for(var i=0;i<L.length;i++){var d=document.createElement('div');
  d.className='s'+(i===step?' active':i<step?' done':'');d.innerHTML='<span class="dot"></span>0'+(i+1)+' — '+L[i];stepsEl.appendChild(d);}}

function calendar(){
  var dow=['L','M','M','J','V','S','D'];
  var h='<div class="cal-nav"><button type="button" class="cal-nav__btn" id="calPrev">‹</button><span class="mono">'+MONTHS_FR[state.calMonth]+' '+state.calYear+'</span><button type="button" class="cal-nav__btn" id="calNext">›</button></div>';
  h+='<div class="cal">';
  dow.forEach(function(d){h+='<div class="dow">'+d+'</div>'});
  var first=new Date(state.calYear,state.calMonth,1);
  var off=(first.getDay()+6)%7;
  var dim=new Date(state.calYear,state.calMonth+1,0).getDate();
  var t0=new Date();t0.setHours(0,0,0,0);
  for(var i=0;i<off;i++)h+='<div class="d mut"></div>';
  for(var d=1;d<=dim;d++){
    var dateObj=new Date(state.calYear,state.calMonth,d);
    var iso=state.calYear+'-'+String(state.calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var mut=dateObj<t0;
    h+='<div class="d'+(mut?' mut':'')+(state.jourISO===iso?' sel':'')+'" '+(mut?'':'data-iso="'+iso+'" data-label="'+d+' '+MONTHS_FR[state.calMonth]+'"')+'>'+d+'</div>';
  }
  return h+'</div>';
}

/* prix courant sélectionné (avant promo)
   Seul endroit qui calcule un prix de formule : les véhicules "sportive"
   (exception) se calculent sur la base citadine + le supplément dédié
   (inchangé) ; les 4 gabarits de la grille (citadine/berline/suv/van) ont
   chacun leur tarif propre dans parGabarit, déjà correct — aucun supplément
   à ajouter. */
function priceFor(cleanKey,formIdx,gab){
  var f=CLEAN[cleanKey].formules[formIdx];
  if(!f||f.prix<=0)return 0;
  if(gab==='sportive')return f.prix+GABARITS.sportive.supp;
  var g=gab||'citadine';
  return (f.parGabarit&&f.parGabarit[g])||f.prix;
}
function formuleKey(f){return f.k==='Confort'?'confort':(f.k==='Premium'?'premium':'experience');}
function optsTotal(){var visible=visibleOptions();var t=0;state.opts.forEach(function(id){var o=visible.find(function(x){return x.id===id});if(o)t+=o.prix;});return t;}
function promoEligible(){return PROMO.active && PROMO.formules.indexOf(CLEAN[state.clean].formules[state.form].k)>-1;}
function subTotal(){var bp=basePrice();if(bp<=0)return 0;return bp+optsTotal();}
function grandTotal(){var st=subTotal();if(st<=0)return 0;return (state.promo&&promoEligible())?Math.round(st*(1-PROMO.rate)):st;}
function basePrice(){if(state.type!=='prestation')return 0;return priceFor(state.clean,state.form,state.gab);}
function serviceId(){
  var f=CLEAN[state.clean].formules[state.form];
  var gabForPricing=state.gab==='sportive'?'citadine':(state.gab||'citadine');
  return 'nettoyage-'+CLEAN[state.clean].svc+'-'+formuleKey(f)+'-'+gabForPricing;
}

var navDirection=null;
function setPanel(html){
  panel.classList.remove('panel-fade','panel-fwd','panel-back');
  void panel.offsetWidth;
  panel.innerHTML=html;
  var cls=navDirection==='fwd'?'panel-fwd':(navDirection==='back'?'panel-back':'panel-fade');
  panel.classList.add(cls);
  navDirection=null;
}

var lastAmt=null;
function animateAmt(){
  var el=document.getElementById('amtNum');
  if(!el) return;
  var target=parseInt(el.dataset.target,10);
  if(isNaN(target)){lastAmt=null;return;}
  var start=(lastAmt===null)?target:lastAmt;
  lastAmt=target;
  if(start===target){el.textContent=target;return;}
  var t0=null,dur=500;
  function step(ts){
    if(!t0)t0=ts;
    var p=Math.min((ts-t0)/dur,1);
    var eased=1-Math.pow(1-p,3);
    el.textContent=Math.round(start+(target-start)*eased);
    if(p<1)requestAnimationFrame(step);else el.textContent=target;
  }
  requestAnimationFrame(step);
}

function updateWizMedia(){
  var key=state.type+'-'+step;
  document.querySelectorAll('.wiz-media .wm').forEach(function(img){
    img.classList.toggle('active', img.dataset.key===key);
  });
}

/* Cohérence des promesses : un soin réservable en ligne est confirmé
   immédiatement sur un créneau réellement disponible ; un projet (PPF,
   céramique, covering, Car Staging) est une demande que l'on rappelle. */
var ASIDE_TXT={
  prestation:['Le tarif dépend du véhicule : commençons par lui.',
    'Vous savez déjà ce que vous voulez, ou nous vous guidons en 30 secondes.',
    'Trois niveaux de soin, au tarif exact de votre véhicule.',
    'Des options facultatives, seulement si elles ont du sens.',
    'Créneau confirmé immédiatement, règlement sur place.'],
  projet:['Décrivez votre projet, on vous recontacte pour chiffrer ensemble.',
    'Encore trois étapes.','On y est presque.','Nous revenons vers vous sous 24 h.']
};

function updateProgress(){
  var fill=document.getElementById('wizProgressFill');
  if(!fill) return;
  var L=LAB[state.type];
  fill.style.width=(((step+1)/L.length)*100)+'%';
}

function vehLabel(){
  var v=(state.marque+' '+state.modele).trim();
  return v||(state.vehQuery||'').trim()||'';
}
/* Récapitulatif « configurateur » : le véhicule reste visible pendant tout
   le parcours, avec un accès direct pour le modifier. Tous les montants
   proviennent du moteur tarifaire central (priceFor / optsTotal). */
function recapHtml(){
  var f=CLEAN[state.clean].formules[state.form];
  var h='<div class="ws-veh"><div><span class="ws-k">Véhicule</span>'+
        '<b>'+(vehLabel()||'À renseigner')+'</b>'+
        (state.gab?'<span class="ws-gab">'+GABARITS[state.gab].label+'</span>':'')+'</div>'+
        (state.gab?'<button type="button" class="ws-edit" data-goto="0">Modifier</button>':'')+'</div>';
  if(step<2) return h;
  h+='<div class="ws-rows">';
  h+='<div class="ws-row"><span>Soin</span><b>'+f.k+'</b></div>';
  h+='<div class="ws-row"><span>Prestation</span><b>'+CLEAN[state.clean].label+'</b></div>';
  var vis=visibleOptions();
  var chosen=state.opts.map(function(id){return vis.find(function(o){return o.id===id});}).filter(Boolean);
  if(step>=3) h+='<div class="ws-row"><span>Options</span><b>'+(chosen.length?chosen.map(function(o){return o.nom;}).join(', '):'Aucune')+'</b></div>';
  if(state.jourLabel&&state.heure) h+='<div class="ws-row"><span>Créneau</span><b>'+state.jourLabel+' · '+state.heure+'</b></div>';
  h+='</div>';
  var gt=grandTotal();
  h+='<div class="ws-total"><span>Total</span><b>'+(gt>0?(gt+' € TTC'):'sur devis')+'</b></div>';
  return h;
}

function updateAsideSummary(){
  var el=document.getElementById('wizSummary');
  if(!el) return;

  if(state.type==='prestation'){
    if(step<1&&!state.gab){el.innerHTML='';el.style.display='none';return;}
    el.innerHTML='<div class="ws-title mono">Votre REYCE</div>'+recapHtml();
    el.style.display='block';
    el.querySelectorAll('[data-goto]').forEach(function(b){
      b.addEventListener('click',function(){step=+b.dataset.goto;navDirection='back';render();});
    });
    return;
  }
  if(step<1){el.innerHTML='';el.style.display='none';return;}

  // ---- flux projet ----
  var prows='';
  if(state.projet.length){prows+='<div class="ws-row"><span>Projet</span><b>'+state.projet.map(function(i){return projets[i].label;}).join(', ')+'</b></div>';}
  if(step>=1&&(state.marque||state.modele)){prows+='<div class="ws-row"><span>Véhicule</span><b>'+((state.marque+' '+state.modele).trim())+'</b></div>';}
  if(step>=2&&state.mode){prows+='<div class="ws-row"><span>Échange</span><b>'+state.mode+'</b></div>';}
  if(!prows){el.innerHTML='';el.style.display='none';return;}
  el.innerHTML=prows;
  el.style.display='block';
}

function render(){renderSteps();updateWizMedia();updateProgress();var h='';var L=LAB[state.type];
  asideTitle.textContent=state.type==='prestation'?'Composez votre soin.':'Parlons projet.';
  asideText.textContent=ASIDE_TXT[state.type][step]||ASIDE_TXT[state.type][0];
  updateAsideSummary();
  var head='<div class="plabel"><span class="mono">Étape 0'+(step+1)+' / 0'+L.length+'</span><span class="mono">'+L[step]+'</span></div>';

  /* ---------- FLUX PRESTATION (nettoyage + acompte) ---------- */
  if(state.type==='prestation'){
    /* ---------- 01 · VÉHICULE ----------
       Le véhicule est demandé avant toute recommandation : le tarif en
       dépend, le client ne doit jamais le découvrir à la fin. */
    if(step===0){
      h+=head+'<h4>Quel véhicule nous confiez-vous ?</h4>';
      if(state.gab&&!state.vehUnknown&&state.gabAuto){
        h+='<div class="veh-picked"><div class="vp-main"><span class="mono">Véhicule identifié</span>'+
           '<b>'+vehLabel()+'</b><span class="vp-cat">'+GABARITS[state.gab].label+'</span></div>'+
           '<button type="button" class="btn-line" id="vehReset">Modifier</button></div>'+
           '<p class="veh-note">Le tarif affiché ensuite correspondra exactement à ce gabarit.</p>';
      } else if(state.vehUnknown){
        h+='<div class="veh-unknown"><p>Nous n\'avons pas encore identifié automatiquement ce modèle'+
           (state.vehQuery?' (<b>'+state.vehQuery+'</b>)':'')+'.</p>'+
           '<p class="vu-sub">Indiquez simplement son gabarit — le tarif en dépend.</p></div>'+
           '<div class="gabs" id="gabbox" role="radiogroup" aria-label="Gabarit du véhicule">';
        for(var gk in GABARITS){
          h+='<button type="button" role="radio" aria-checked="'+(state.gab===gk?'true':'false')+'" class="gabo'+(state.gab===gk?' sel':'')+'" data-gab="'+gk+'">'+
             '<b>'+GABARITS[gk].label+'</b><span>'+GABARITS[gk].desc+'</span></button>';
        }
        h+='</div><p class="veh-note"><button type="button" class="btn-line" id="vehReset">Rechercher à nouveau</button></p>';
      } else {
        h+='<div class="vehsearch"><div class="field">'+
           '<label for="vehq">Marque ou modèle</label>'+
           '<input id="vehq" autocomplete="off" placeholder="BMW X3 M, Clio, Cayenne, Model 3…" value="'+(state.vehQuery||'').replace(/"/g,'&quot;')+'">'+
           '<div class="ac" id="ac"></div></div></div>'+
           '<p class="veh-note">Tapez les premières lettres : nous identifions le modèle et son gabarit tarifaire.</p>'+
           '<p style="margin-top:14px"><button type="button" class="btn-line" id="noModel">Je ne trouve pas mon véhicule</button></p>';
      }
    }
    /* ---------- 02 · BESOIN ----------
       Aiguillage : parcours direct ou questionnaire guidé. Les deux
       aboutissent au même triplet (gabarit, formule, prestation). */
    else if(step===1){
      if(state.need==='quiz'){
        var qs=quizSteps();
        if(state.quizIdx<qs.length){
          var qq=qs[state.quizIdx];
          var cur=state.quiz[qq.key];
          h+='<div class="plabel"><span class="mono">Question 0'+(state.quizIdx+1)+' / 0'+qs.length+'</span><span class="mono">Besoin</span></div>';
          h+='<h4>'+qq.q+'</h4>';
          h+='<div class="qopts" role="'+(qq.multi?'group':'radiogroup')+'" aria-label="'+qq.q.replace(/"/g,'')+'">';
          qq.opts.forEach(function(o){
            var on=qq.multi?((cur||[]).indexOf(o[0])>-1):(cur===o[0]);
            h+='<button type="button" class="qopt'+(on?' sel':'')+'" data-q="'+qq.key+'" data-v="'+o[0]+'"'+
               (qq.multi?' aria-pressed="'+(on?'true':'false')+'"':' role="radio" aria-checked="'+(on?'true':'false')+'"')+'>'+
               '<span class="qo-mark">'+(on?'✓':'')+'</span>'+
               '<span class="qo-body"><b>'+o[1]+'</b>'+(o[2]?'<span>'+o[2]+'</span>':'')+'</span>'+
               (o[3]?'<span class="qo-tag">'+o[3]+'</span>':'')+'</button>';
          });
          h+='</div>';
          if(qq.multi) h+='<p class="veh-note">Plusieurs réponses possibles — passez si rien ne correspond.</p>';
        } else {
          var r=state.reco||computeReco();
          var rf=CLEAN[r.clean].formules[r.form];
          var rprice=priceFor(r.clean,r.form,state.gab);
          h+='<div class="plabel"><span class="mono">Notre recommandation</span><span class="mono">Besoin</span></div>';
          h+='<h4>Notre recommandation pour votre '+(vehLabel()||GABARITS[state.gab||'citadine'].label)+'</h4>';
          h+='<div class="reco-card">'+
             '<div class="rc-head"><div><div class="rc-k">'+rf.k+'</div><div class="rc-sub">'+TIER_SUB[rf.k]+'</div>'+
             '<div class="rc-area">'+CLEAN[r.clean].label+'</div></div>'+
             '<div class="rc-price">'+euro(rprice)+'<span class="rc-ttc">TTC</span></div></div>'+
             '<p class="rc-pitch">'+rf.pitch+'</p>';
          if(r.why.length){
            h+='<div class="rc-why"><span class="mono">Pourquoi cette recommandation ?</span><ul>'+
               r.why.map(function(w){return '<li><span class="tk">—</span>'+w+'</li>';}).join('')+'</ul></div>';
          }
          h+='</div>';
          h+='<div class="reco-cta"><button type="button" class="btn solid" id="recoTake">Choisir '+rf.k+' — '+rprice+' €</button>'+
             '<button type="button" class="btn ghost" id="recoOther">Voir les autres formules</button></div>';
        }
      } else {
        h+=head+'<h4>Comment souhaitez-vous avancer ?</h4>';
        h+='<div class="need2">'+
           '<button type="button" class="needcard" data-need="direct">'+
             '<span class="nk">Je sais ce que je veux</span>'+
             '<b>Voir directement les soins REYCE</b>'+
             '<span class="nd">Confort, Premium ou Expérience — avec le tarif de votre véhicule.</span></button>'+
           '<button type="button" class="needcard" data-need="quiz">'+
             '<span class="nk">Conseillez-moi</span>'+
             '<b>30 secondes pour trouver la prestation adaptée</b>'+
             '<span class="nd">Quelques questions simples, puis notre recommandation.</span></button>'+
           '</div>';
      }
    }
    /* ---------- 03 · SOIN ----------
       Prestation (intérieur / extérieur / complet) + niveau de soin.
       Tous les prix affichés proviennent de priceFor() : le questionnaire
       et le parcours direct passent exactement par le même moteur. */
    else if(step===2){
      var fs=CLEAN[state.clean].formules;
      h+=head;
      if(state.reco){
        var rf0=CLEAN[state.reco.clean].formules[state.reco.form];
        h+='<div class="reco-banner"><span class="mono">Recommandé pour votre '+(vehLabel()||'véhicule')+'</span>'+
           '<b>'+rf0.k+' · '+CLEAN[state.reco.clean].label+'</b>'+
           '<span class="rb-note">Vous pouvez choisir une autre formule à tout moment.</span></div>';
      }
      h+='<h4>Votre soin pour '+(vehLabel()||'votre véhicule')+'</h4>';
      h+='<div class="areasel" role="radiogroup" aria-label="Prestation">';
      [['interieur','Intérieur'],['exterieur','Extérieur'],['duo','Intérieur + Extérieur']].forEach(function(row){
        var key=row[0], on=state.clean===key;
        h+='<button type="button" role="radio" aria-checked="'+(on?'true':'false')+'" class="areabtn'+(on?' sel':'')+'" data-clean="'+key+'">'+
           '<span class="ab-mark">'+(on?'✓':'')+'</span>'+
           '<span class="ab-l">'+row[1]+'</span>'+
           '<span class="ab-p">'+euroTxt(priceFor(key,state.form,state.gab))+'</span>'+
           (key==='duo'?'<span class="ab-tag">Recommandé</span>':'')+'</button>';
      });
      h+='</div>';
      h+='<div class="forms">';
      fs.forEach(function(f,i){
        var isReco=state.reco&&state.reco.form===i&&state.reco.clean===state.clean;
        var cls='formcard'+(state.form===i?' sel':'')+(f.reco?' reco':'')+(f.top?' top':'');
        var tag=isReco?'<span class="tag">Recommandé pour vous</span>'
                      :(f.top?'<span class="tag alt">Signature REYCE</span>':(f.reco?'<span class="tag">Le plus choisi</span>':''));
        var hi='<ul>'+f.highlights.map(function(x){return '<li><span class="tk">—</span>'+x+'</li>'}).join('')+'</ul>';
        var detailHtml='';
        if(f.detailInt&&f.detailExt){
          detailHtml='<details class="fdetail"><summary><span>Voir tout ce qui est inclus</span><span class="pm"></span></summary>'+
            '<div class="fdetail-group"><h5>Intérieur</h5><ul>'+f.detailInt.map(function(x){return '<li><span class="tk">—</span>'+x+'</li>'}).join('')+'</ul></div>'+
            '<div class="fdetail-group"><h5>Extérieur</h5><ul>'+f.detailExt.map(function(x){return '<li><span class="tk">—</span>'+x+'</li>'}).join('')+'</ul></div>'+
            '</details>';
        } else if(f.detail){
          detailHtml='<details class="fdetail"><summary><span>Voir tout ce qui est inclus</span><span class="pm"></span></summary>'+
            '<ul>'+f.detail.map(function(x){return '<li><span class="tk">—</span>'+x+'</li>'}).join('')+'</ul></details>';
        }
        h+='<div class="'+cls+'" data-form="'+i+'" role="radio" tabindex="0" aria-checked="'+(state.form===i?'true':'false')+'">'+tag+
           '<div><div class="fk">'+f.k+'</div><h4>'+f.nom+'</h4><div class="fsub">'+TIER_SUB[f.k]+'</div></div>'+
           '<div class="price">'+euro(priceFor(state.clean,i,state.gab))+'<span class="ttc">TTC</span></div>'+
           '<p class="fpitch">'+f.pitch+'</p>'+hi+detailHtml+
           (f.outro?'<p class="fnote">'+f.outro+'</p>':'')+
           '<div class="pick">'+(state.form===i?'Sélectionnée':(f.top?'Vivre l\'expérience':'Choisir'))+'</div></div>';
      });
      h+='</div>';

      var sv=duoSave(state.form);
      if(state.clean==='duo'){
        h+='<div class="combo">';
        if(sv){h+='<div class="l"><span>Les deux soins séparément</span><s>'+sv.sep+' €</s></div>';}
        h+='<div class="tot"><span>Formule complète '+fs[state.form].k+'</span><span class="v">'+euroTxt(priceFor('duo',state.form,state.gab))+'</span></div>';
        if(sv){h+='<div class="eco">Le complet vous fait économiser '+sv.save+' € — et va au bout des choses</div>';}
        else{h+='<div class="eco">Le soin le plus abouti, dedans comme dehors</div>';}
        h+='</div>';
      }
    }
    /* ---------- 04 · OPTIONS ----------
       Jamais une option déjà comprise dans la formule retenue. */
    else if(step===3){
      h+=head+'<h4>Souhaitez-vous ajouter une option ?</h4>';
      h+='<p class="veh-note" style="margin-bottom:18px">Facultatif — votre soin '+CLEAN[state.clean].formules[state.form].k+' est déjà complet sans elles.</p>';
      h+='<div class="optgrid">';
      var showVarNote=false;
      visibleOptions().forEach(function(op){
        var on=state.opts.indexOf(op.id)>-1;
        if(on&&op.variable) showVarNote=true;
        h+='<button type="button" class="optcard'+(on?' sel':'')+'" data-opt="'+op.id+'" aria-pressed="'+(on?'true':'false')+'">'+
           '<span class="optck">'+(on?'✓':'+')+'</span>'+
           '<span class="optbody"><b>'+op.nom+'</b><span class="optd">'+op.desc+'</span></span>'+
           '<span class="optp"><i>à partir de</i>'+op.prix+'&nbsp;€</span></button>';
      });
      h+='</div>';
      if(showVarNote) h+='<p class="optnote">'+OPTS_VARIABLE_NOTE+'</p>';

      /* Car Staging — proposé uniquement quand le besoin exprimé le
         justifie. Jamais un « ajout au panier » : on renvoie vers le flux
         projet existant pour échanger avec un technicien. */
      if(stagingRelevant()){
        var top=state.form===2;
        h+='<div class="staging-upsell'+(top?' staging-upsell--top':'')+'">'+
           '<p class="staging-hook">'+(top?STAGING.hookExperience:'Vous recherchez une remise à neuf encore plus complète ?')+'</p>'+
           '<div class="staging-card'+(top?' staging-card--top':'')+'">'+
             '<div class="staging-body"><span class="staging-kicker">'+STAGING.kicker+(top?' — Signature REYCE':'')+'</span><h4>'+STAGING.titre+'</h4>'+
             '<p>'+STAGING.lead+'</p>'+(top?'<p class="staging-ceramique">'+STAGING.ceramique+'</p>':'')+'</div>'+
             '<div class="staging-cta"><span class="staging-price">À partir de '+STAGING.prix+'&nbsp;€</span>'+
             '<button type="button" class="btn'+(top?'':' ghost')+'" id="stagingBtn">'+(top?'Parler de mon véhicule à un technicien':'Découvrir le Car Staging')+'</button></div>'+
           '</div></div>';
      }
    }
    /* ---------- 05 · CRÉNEAU + CONFIRMATION ----------
       Les coordonnées n'apparaissent qu'une fois le créneau choisi :
       aucune information déjà collectée n'est redemandée. */
    else if(step===4){
      var f=CLEAN[state.clean].formules[state.form];
      h+=head;
      h+='<div class="tunnel-done"><span class="mono">Votre soin est configuré</span>'+
         '<b>'+f.k+' · '+CLEAN[state.clean].label+' · '+euroTxt(grandTotal())+'</b></div>';
      h+='<h4>Choisissez quand nous confier votre véhicule.</h4>';
      h+='<div id="calWrap">'+calendar()+'</div>'+
      '<div class="field" style="margin-top:24px"><label id="heureLbl">Heure d\'arrivée</label><div class="chips" id="heureChips" role="radiogroup" aria-labelledby="heureLbl">';
      times.forEach(function(t){h+='<div class="chip'+(state.heure===t?' sel':'')+'" data-t="'+t+'" role="radio" tabindex="0" aria-checked="'+(state.heure===t?'true':'false')+'">'+t+'</div>'});
      h+='</div></div>';

      if(state.jourISO&&state.heure){
        h+='<div class="coord-block"><h4 style="margin-bottom:6px">Vos coordonnées</h4>'+
           '<p class="veh-note" style="margin-bottom:18px">Dernière étape — nous avons déjà tout le reste.</p>'+
           '<div class="row2">'+
             '<div class="field"><label for="prenom">Prénom</label><input id="prenom" autocomplete="given-name" placeholder="Prénom" value="'+(state.prenom||'').replace(/"/g,'&quot;')+'"></div>'+
             '<div class="field"><label for="nomFam">Nom</label><input id="nomFam" autocomplete="family-name" placeholder="Nom" value="'+(state.nomFam||'').replace(/"/g,'&quot;')+'"></div>'+
           '</div>'+
           '<div class="row2">'+
             '<div class="field"><label for="tel">Téléphone</label><input id="tel" type="tel" autocomplete="tel" placeholder="06 …" value="'+(state.tel||'').replace(/"/g,'&quot;')+'"></div>'+
             '<div class="field"><label for="email">Email</label><input id="email" type="email" autocomplete="email" placeholder="vous@email.com" value="'+(state.email||'').replace(/"/g,'&quot;')+'"></div>'+
           '</div></div>';
      }

      h+='<div class="recap">'+
        '<div class="rl"><span>Véhicule</span><b>'+(vehLabel()||'—')+(state.gab?' · '+GABARITS[state.gab].label:'')+'</b></div>'+
        '<div class="rl"><span>Prestation</span><b>'+CLEAN[state.clean].label+'</b></div>'+
        '<div class="rl"><span>Soin</span><b>'+f.k+'</b></div>'+
        '<div class="rl"><span>Créneau</span><b>'+(state.jourLabel?(state.jourLabel+' · '+(state.heure||'—')):'—')+'</b></div>'+
        (function(){var vis=visibleOptions();var noms=state.opts.map(function(id){var o=vis.find(function(x){return x.id===id});return o?o.nom:'';}).filter(Boolean);
          return noms.length?'<div class="rl"><span>Options</span><b>'+noms.join(', ')+'</b></div>':'';})()+
      '</div>';
      if(PROMO.active){
        if(state.promo && promoEligible()){
          h+='<div class="promo-ok">✓ Code '+PROMO.code+' appliqué — <span class="x">−10 %</span></div>';
        } else {
          h+='<div class="promo-field"><input id="promoInput" placeholder="Code promo" value=""><button type="button" id="promoBtn">Appliquer</button></div>';
          h+='<p class="promo-hint" id="promoHint">Code −10 % valable sur les formules Premium et Expérience.</p>';
        }
      }
      h+='<div class="pricebar"><span class="lbl">Total estimé</span><span class="amt">';
      var st=subTotal(), gt=grandTotal();
      if(st>0){ h+= (state.promo&&promoEligible()) ? ('<s>'+st+' €</s><span id="amtNum" data-target="'+gt+'">'+gt+'</span> €') : ('<span id="amtNum" data-target="'+st+'">'+st+'</span> €'); }
      else { h+='sur devis'; }
      h+='</span></div>';
      if(state.promo&&promoEligible()){h+='<p style="color:var(--dim);margin-top:8px;font-size:.8rem">Remise BIENVENUE10 : −'+(st-gt)+' €.</p>';}
      else if(optsTotal()>0){h+='<p style="color:var(--dim);margin-top:8px;font-size:.8rem">Dont formule '+basePrice()+' € + options '+optsTotal()+' €.</p>';}
      h+='<p style="color:var(--dim-2);margin-top:10px;font-size:.78rem">'+(STRIPE_ENABLED?'Un acompte de 40&nbsp;€ confirme votre créneau ; il est déduit du montant final réglé sur place selon l\'état réel du véhicule.':'Votre créneau est confirmé immédiatement ; le règlement se fait sur place selon l\'état réel du véhicule.')+'</p>';
    }
    var last=L.length-1;
    var lastLabel=STRIPE_ENABLED?'Payer l\'acompte et confirmer':'Confirmer le rendez-vous';
    /* Les écrans où le choix fait lui-même avancer (aiguillage, question à
       réponse unique, recommandation) n'affichent pas de « Continuer » :
       un seul geste par écran, le parcours paraît plus court. */
    var showNext=true;
    if(step===1){
      if(state.need!=='quiz') showNext=false;
      else{
        var qsn=quizSteps();
        showNext=(state.quizIdx<qsn.length)&&!!qsn[state.quizIdx].multi;
      }
    }
    h+='<div class="pnav"><button type="button" class="btn ghost" id="back" '+(step===0?'style="visibility:hidden"':'')+'>← Retour</button>'+
       (showNext?('<button type="button" class="btn" id="next">'+(step===last?lastLabel:'Continuer →')+'</button>'):'')+'</div>';
    setPanel(h);bindP(last);animateAmt();updateSticky();return;
  }

  /* ---------- FLUX PROJET ---------- */
  if(step===0){h+=head+'<h4>Votre projet porte sur…</h4><div class="proj-grid" id="projGrid">';
    projets.forEach(function(p,i){h+='<button type="button" class="proj-card'+(state.projet.indexOf(i)>-1?' sel':'')+'" data-pj="'+i+'" style="background-image:url(\''+p.img+'\')"><span class="pc-check">✓</span><span class="pc-label">'+p.label+'</span></button>'});
    h+='</div><p style="color:var(--dim-2);margin-top:16px;font-size:.82rem">Sélection multiple possible.</p>';}
  else if(step===1){h+=head+'<h4>Votre voiture.</h4><div class="row2">'+
    '<div class="field"><label>Marque</label><input id="marque" placeholder="Porsche, BMW…" value="'+state.marque+'"></div>'+
    '<div class="field"><label>Modèle</label><input id="modele" placeholder="911, M4…" value="'+state.modele+'"></div></div>';}
  else if(step===2){h+=head+'<h4>Comment préférez-vous échanger ?</h4><div class="chips" id="modeChips" style="margin-bottom:24px">';
    contactModes.forEach(function(m){h+='<div class="chip'+(state.mode===m?' sel':'')+'" data-m="'+m+'">'+m+'</div>'});
    h+='</div><h4>Une date souhaitée (optionnel)</h4><div id="calWrap">'+calendar()+'</div>';}
  else if(step===3){h+=head+'<h4>On vous recontacte.</h4>'+
    '<div class="field"><label>Nom complet</label><input id="nom" placeholder="Votre nom" value="'+state.nom+'"></div>'+
    '<div class="row2"><div class="field"><label>Téléphone</label><input id="tel" placeholder="06 …" value="'+state.tel+'"></div>'+
    '<div class="field"><label>Email</label><input id="email" placeholder="vous@email.com" value="'+state.email+'"></div></div>'+
    '<div class="field"><label>Votre projet en quelques mots</label><textarea id="msg" placeholder="Décrivez ce que vous avez en tête…">'+state.msg+'</textarea></div>'+
    '<div class="field"><label>Photos (optionnel — 3 max)</label>'+
      '<label class="photo-drop" id="photoDrop"><input type="file" id="photoInput" accept="image/*" multiple style="display:none"><span>Cliquez pour ajouter des photos de votre véhicule</span></label>'+
      '<div class="photo-list" id="photoList"></div></div>'+
    '<div class="expert-note"><div class="expert-ava">R</div><p>Un expert de l\'atelier REYCE lit chaque demande personnellement et vous recontacte sous 24&nbsp;h.</p></div>'+
    '<div class="recap"><div class="rl"><span>Projet</span><b>'+(state.projet.map(function(i){return projets[i].label}).join(', ')||'—')+'</b></div>'+
    '<div class="rl"><span>Véhicule</span><b>'+((state.marque||'—')+' '+state.modele)+'</b></div>'+
    '<div class="rl"><span>Échange</span><b>'+((state.mode||'—')+(state.jourLabel?(' · le '+state.jourLabel):''))+'</b></div></div>';}
  var lastJ=LAB.projet.length-1;
  h+='<div class="pnav"><button type="button" class="btn ghost" id="back" '+(step===0?'style="visibility:hidden"':'')+'>← Retour</button>'+
     '<button type="button" class="btn" id="next">'+(step===lastJ?'Envoyer la demande':'Continuer →')+'</button></div>';
  setPanel(h);bindJ(lastJ);updateSticky();
}

function splitName(full){
  full=(full||'').trim();
  var i=full.indexOf(' ');
  if(i===-1) return {firstName: full||'Client', lastName: '—'};
  return {firstName: full.slice(0,i), lastName: full.slice(i+1)};
}

function showError(msg,resetNextLabel){
  var next=document.getElementById('next');
  if(next&&resetNextLabel){next.disabled=false;next.textContent=resetNextLabel;}
  var err=document.getElementById('bookErr');
  if(!err){
    err=document.createElement('p');
    err.id='bookErr';
    err.style.cssText='color:#fff;background:rgba(255,255,255,.08);border:1px solid var(--line);padding:12px 16px;margin-top:14px;font-size:.85rem';
    panel.appendChild(err);
  }
  err.textContent=msg;
}

function showDoneScreen(title, msg){
  stepsEl.querySelectorAll('.s').forEach(function(s){s.className='s done';});
  panel.innerHTML='<div class="done-screen"><div class="mark">✓</div><h4 class="disp">'+title+'</h4><p>'+msg+'</p><p class="mono" style="margin-top:8px">Lyon</p><button type="button" class="btn" id="again" style="margin-top:16px">Nouvelle demande</button></div>';
  document.getElementById('again').addEventListener('click',function(){step=0;
    state=freshState(state.type);lastAmt=null;render();});
}

/* Résumé lisible des options sélectionnées (respecte l'exclusion ozone
   déjà incluse dans l'Expérience) — stocké dans les notes de réservation,
   seul endroit déjà relié aux emails/SMS de confirmation sans nécessiter
   de nouveau champ en base. Le prix réellement facturé, lui, est toujours
   recalculé côté serveur à partir des ids d'options (voir computeOptsCents
   dans server.js) : le client n'envoie jamais de montant. */
function optsNotes(){
  var vis=visibleOptions();
  var chosen=state.opts.map(function(id){return vis.find(function(o){return o.id===id});}).filter(Boolean);
  if(!chosen.length) return undefined;
  return 'Options : '+chosen.map(function(o){return o.nom;}).join(', ');
}

function done(){
  if(state.type==='prestation'){
    var next=document.getElementById('next');
    var nm={firstName:(state.prenom||'').trim(), lastName:(state.nomFam||'').trim()};
    var f=CLEAN[state.clean].formules[state.form];

    if(STRIPE_ENABLED){
      if(next){next.disabled=true;next.textContent='Redirection vers le paiement…';}
      fetch('/api/create-checkout-session',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          service: serviceId(),
          vehicleType: state.gab,
          vehicleModel: (state.marque+' '+state.modele).trim(),
          date: state.jourISO,
          time: state.heure,
          client: {firstName: nm.firstName, lastName: nm.lastName, phone: state.tel, email: state.email, notes: optsNotes()},
          opts: state.opts,
          paymentType: 'deposit'
        })
      }).then(function(r){return r.json();}).then(function(data){
        if(data.error){showError(data.error,'Payer l\'acompte et confirmer');return;}
        if(data.url){window.location.href=data.url;}
      }).catch(function(){showError('Erreur de connexion. Vérifiez votre réseau et réessayez.','Payer l\'acompte et confirmer');});
      return;
    }

    // ---- paiement en pause : réservation directe, confirmée sans Stripe ----
    if(next){next.disabled=true;next.textContent='Confirmation…';}
    var parcours='Parcours : '+(state.reco?'recommandation guidée':'sélection directe');
    var notesParts=[optsNotes(),parcours,utmNoteLine()].filter(Boolean);
    fetch('/api/create-booking',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        service: serviceId(),
        vehicleType: state.gab,
        vehicleModel: vehLabel(),
        date: state.jourISO,
        time: state.heure,
        client: {firstName: nm.firstName, lastName: nm.lastName, phone: state.tel, email: state.email, notes: notesParts.length?notesParts.join(' — '):undefined},
        opts: state.opts
      })
    }).then(function(r){return r.json();}).then(function(data){
      if(data.error){showError(data.error,'Confirmer le rendez-vous');return;}
      if(data.sessionId){
        /* booking_complete : conversion principale, déclenchée uniquement
           ici — après confirmation réelle côté serveur, jamais au clic.
           La valeur envoyée est le montant TTC réel de la réservation,
           pour permettre une optimisation Google Ads au chiffre d'affaires. */
        pushEvt({
          event:'booking_complete', service:serviceId(), formula:f.k,
          service_area:state.clean, clean_type:state.clean,
          vehicle_type:state.gab, vehicle_label:vehLabel()||null,
          journey:state.reco?'recommendation':'direct',
          value:grandTotal(), currency:'EUR'
        });
        var qs='session_id='+encodeURIComponent(data.sessionId);
        var utm=utmQueryString();
        if(utm)qs+='&'+utm;
        setTimeout(function(){window.location.href='/confirmation.html?'+qs;},250);
        return;
      }
    }).catch(function(){showError('Erreur de connexion. Vérifiez votre réseau et réessayez.','Confirmer le rendez-vous');});
    return;
  }

  // ---- flux projet : demande de devis via /api/contact ----
  var next=document.getElementById('next');
  if(next){next.disabled=true;next.textContent='Envoi…';}
  var nm=splitName(state.nom);
  var vehicleInfo=(state.marque||state.modele)?((state.marque+' '+state.modele).trim()):'';
  var messageParts=[];
  if(state.projet.length) messageParts.push('Projet : '+state.projet.map(function(i){return projets[i].label;}).join(', '));
  if(state.mode) messageParts.push('Échange souhaité : '+state.mode);
  if(state.jourLabel) messageParts.push('Date souhaitée : '+state.jourLabel);
  if(state.msg.trim()) messageParts.push(state.msg.trim());

  var finish=function(){
    var first=state.nom.split(' ')[0]||'';
    pushEvt({event:'project_request_sent', projects:state.projet.map(function(i){return projets[i].label;})});
    showDoneScreen('Demande envoyée', 'Merci '+first+'. Nous revenons vers vous très vite pour échanger sur votre projet.');
  };

  if(state.photos.length){
    var fd=new FormData();
    fd.append('firstName', nm.firstName);
    fd.append('lastName', nm.lastName);
    fd.append('email', state.email);
    fd.append('phone', state.tel);
    fd.append('subject', 'Discuter d\'un projet');
    fd.append('vehicleInfo', vehicleInfo);
    fd.append('message', messageParts.join(' — '));
    state.photos.forEach(function(f){fd.append('photos', f);});
    fetch('/api/devis-photos',{method:'POST', body: fd}).catch(function(){}).then(finish);
  } else {
    fetch('/api/contact',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        type:'devis',
        firstName: nm.firstName, lastName: nm.lastName,
        email: state.email, phone: state.tel,
        subject: 'Discuter d\'un projet',
        vehicleInfo: vehicleInfo,
        message: messageParts.join(' — ')
      })
    }).catch(function(){}).then(finish);
  }
}

function renderCalendarOnly(){
  var wrap=document.getElementById('calWrap');
  if(!wrap) return;
  wrap.classList.remove('cal-refresh');
  void wrap.offsetWidth;
  wrap.innerHTML=calendar();
  wrap.classList.add('cal-refresh');
  bindCalendarNav();
  bindDateCells();
}
function bindCalendarNav(){
  var prev=document.getElementById('calPrev');
  if(prev)prev.onclick=function(){state.calMonth--;if(state.calMonth<0){state.calMonth=11;state.calYear--;}renderCalendarOnly();};
  var next=document.getElementById('calNext');
  if(next)next.onclick=function(){state.calMonth++;if(state.calMonth>11){state.calMonth=0;state.calYear++;}renderCalendarOnly();};
}
function bindDateCells(){
  document.querySelectorAll('[data-iso]').forEach(function(b){b.onclick=function(){state.jourISO=b.dataset.iso;state.jourLabel=b.dataset.label;navDirection=null;render();};});
}
/* Retour arrière : à l'intérieur du questionnaire, on remonte question par
   question avant de revenir à l'aiguillage, puis aux étapes précédentes. */
function goBack(){
  if(state.type==='prestation'&&step===1){
    if(state.need==='quiz'&&state.quizIdx>0){state.quizIdx--;state.reco=null;navDirection='back';render();return;}
    if(state.need){state.need=null;state.quizIdx=0;state.reco=null;navDirection='back';render();return;}
  }
  if(step>0){step--;navDirection='back';render();}
}
function bindCommon(){
  var back=document.getElementById('back');
  if(back)back.addEventListener('click',goBack);
  bindCalendarNav();
  bindDateCells();
}

function shakeNext(){
  var n=document.getElementById('next');
  if(!n) return;
  n.classList.remove('shake');
  void n.offsetWidth;
  n.classList.add('shake');
}
function flashEl(id){
  var el=document.getElementById(id);
  if(!el) return;
  el.classList.remove('field-flash');
  void el.offsetWidth;
  el.classList.add('field-flash');
}
function fieldError(id,msg){
  flashEl(id);
  var el=document.getElementById(id);
  if(el){el.setAttribute('aria-invalid','true');try{el.focus();}catch(e){}}
  if(msg) showError(msg);
  return false;
}
function validPrestationStep(){
  if(step===0){ if(!state.gab){flashEl('gabbox');return false;} return true; }
  if(step===4){
    if(!state.jourISO){flashEl('calWrap');return false;}
    if(!state.heure){flashEl('heureChips');return false;}
    /* Les quatre coordonnées sont exigées côté serveur : on le signale ici
       plutôt que de laisser partir une requête vouée à échouer. */
    if(!(state.prenom||'').trim()) return fieldError('prenom','Merci d\'indiquer votre prénom.');
    if(!(state.nomFam||'').trim()) return fieldError('nomFam','Merci d\'indiquer votre nom.');
    if(!(state.tel||'').trim()) return fieldError('tel','Merci d\'indiquer un téléphone pour vous joindre.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((state.email||'').trim())) return fieldError('email','Merci d\'indiquer une adresse email valide.');
    return true;
  }
  return true;
}
function validProjetStep(){
  if(step===1){ if(!state.marque.trim()){flashEl('marque');return false;} return true; }
  if(step===2){ if(!state.mode){flashEl('modeChips');return false;} return true; }
  if(step===3){
    if(!state.nom.trim()){flashEl('nom');return false;}
    if(!state.tel.trim()&&!state.email.trim()){flashEl('tel');flashEl('email');return false;}
    return true;
  }
  return true;
}

/* Une carte sélectionnable doit se comporter comme un vrai contrôle :
   activable au clavier (Entrée / Espace) autant qu'à la souris. */
function bindCard(el,fn){
  el.addEventListener('click',fn);
  el.addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key===' '||e.key==='Spacebar'){e.preventDefault();fn();}
  });
}

function bindP(last){
  panel.querySelectorAll('[data-clean]').forEach(function(b){b.addEventListener('click',function(){
    state.clean=b.dataset.clean;
    pushEvt({event:'service_area_selected', service_area:state.clean, vehicle_type:state.gab});
    render();
  })});
  panel.querySelectorAll('[data-form]').forEach(function(b){bindCard(b,function(){
    state.form=+b.dataset.form;
    pushEvt({event:'formula_selected', formula:CLEAN[state.clean].formules[state.form].k,
             service_area:state.clean, vehicle_type:state.gab, value:grandTotal(), currency:'EUR'});
    render();
  })});
  panel.querySelectorAll('.fdetail summary').forEach(function(s){s.addEventListener('click',function(e){e.stopPropagation();})});

  /* ---- aiguillage « je sais / conseillez-moi » ---- */
  panel.querySelectorAll('[data-need]').forEach(function(b){b.addEventListener('click',function(){
    state.need=b.dataset.need;
    if(state.need==='quiz'){
      state.quizIdx=0;state.quiz={};state.reco=null;
      pushEvt({event:'recommendation_start', vehicle_type:state.gab});
      navDirection='fwd';render();
    } else {
      state.reco=null;
      navDirection='fwd';step=2;render();
    }
  })});

  /* ---- questionnaire guidé ---- */
  panel.querySelectorAll('[data-q]').forEach(function(b){b.addEventListener('click',function(){
    var key=b.dataset.q, val=b.dataset.v, qs=quizSteps(), qq=qs[state.quizIdx];
    if(qq&&qq.multi){
      var cur=state.quiz[key]||[];
      if(val==='aucun'){ cur=[]; }
      else { var i=cur.indexOf(val); if(i>-1)cur.splice(i,1); else {cur=cur.filter(function(x){return x!=='aucun';});cur.push(val);} }
      state.quiz[key]=cur;
      render();
    } else {
      state.quiz[key]=val;
      /* Changer de zone rend caduques les réponses conditionnelles. */
      if(key==='area'){state.quiz.intFlags=null;state.quiz.extFlags=null;}
      state.quizIdx++;
      if(state.quizIdx>=quizSteps().length) finishQuiz();
      navDirection='fwd';render();
    }
  })});
  var recoTake=document.getElementById('recoTake');
  if(recoTake)recoTake.addEventListener('click',function(){
    var r=state.reco;
    pushEvt({event:'formula_selected', formula:CLEAN[r.clean].formules[r.form].k, source:'recommendation',
             service_area:r.clean, vehicle_type:state.gab, value:grandTotal(), currency:'EUR'});
    navDirection='fwd';step=2;render();
  });
  var recoOther=document.getElementById('recoOther');
  if(recoOther)recoOther.addEventListener('click',function(){navDirection='fwd';step=2;render();});
  var stagingBtn=document.getElementById('stagingBtn');
  if(stagingBtn)stagingBtn.addEventListener('click',function(){pushEvt({event:'staging_click', formula:CLEAN[state.clean].formules[state.form].k});goToProjet(STAGING_PROJ_IDX);});
  panel.querySelectorAll('[data-opt]').forEach(function(b){b.addEventListener('click',function(){var id=b.dataset.opt;var k=state.opts.indexOf(id);if(k>-1){state.opts.splice(k,1);}else{state.opts.push(id);pushEvt({event:'option_selected', option:id});}render()})});
  var promoBtn=document.getElementById('promoBtn');
  if(promoBtn)promoBtn.addEventListener('click',function(){
    var v=(document.getElementById('promoInput').value||'').trim().toUpperCase();
    var hint=document.getElementById('promoHint');
    if(v!==PROMO.code){ if(hint){hint.textContent='Code invalide.';hint.style.color='#fff';} return; }
    if(!promoEligible()){ if(hint){hint.textContent='Ce code est valable sur Premium et Expérience. Choisissez l\'une de ces formules pour en profiter.';hint.style.color='#fff';} return; }
    state.promo=true; render();
  });
  panel.querySelectorAll('[data-t]').forEach(function(b){bindCard(b,function(){
    if(b.classList.contains('taken'))return;
    state.heure=b.dataset.t;pushEvt({event:'slot_selected', slot_time:state.heure, slot_date:state.jourISO});render();
  })});
  function bI(id,key){var el=document.getElementById(id);if(el)el.addEventListener('input',function(e){
    state[key]=e.target.value; el.removeAttribute('aria-invalid');
    var err=document.getElementById('bookErr'); if(err)err.remove();
  })}
  bI('prenom','prenom');bI('nomFam','nomFam');bI('tel','tel');bI('email','email');

  /* ---- étape véhicule : recherche unifiée marque + modèle ---- */
  var acBox=document.getElementById('ac');
  var vehq=document.getElementById('vehq');
  function closeAc(){ if(acBox){acBox.innerHTML='';acBox.classList.remove('on');} }
  /* Après le véhicule : on passe à l'aiguillage, sauf si la campagne
     Google Ads a déjà orienté la prestation (?service=…) — dans ce cas on
     va droit aux soins, tout restant modifiable. */
  function afterVehicle(){
    navDirection='fwd';
    step=(state.need==='direct')?2:1;
    render();
  }
  function pickVehicle(marque,modele,gab){
    state.marque=marque;state.modele=modele;state.gab=gab;
    state.gabAuto=true;state.vehUnknown=false;state.vehQuery=(marque+' '+modele).trim();
    closeAc();
    pushEvt({event:'vehicle_selected', vehicle_type:gab, vehicle_label:state.vehQuery, recognised:true});
    afterVehicle();
  }
  function suggest(){
    if(!acBox)return;
    var res=searchVehicles(state.vehQuery,7);
    if(!res.length){closeAc();return;}
    acBox.innerHTML=res.map(function(v){
      return '<button type="button" class="aci" data-mk="'+v.marque+'" data-md="'+v.modele+'" data-gb="'+v.gab+'">'+
             '<b>'+v.marque+' '+v.modele+'</b><span>'+GABARITS[v.gab].label+'</span></button>';
    }).join('');
    acBox.classList.add('on');
    acBox.querySelectorAll('.aci').forEach(function(bt){bt.addEventListener('click',function(){
      pickVehicle(bt.dataset.mk,bt.dataset.md,bt.dataset.gb);
    });});
  }
  if(vehq){
    vehq.addEventListener('input',function(e){state.vehQuery=e.target.value;suggest();});
    vehq.addEventListener('focus',suggest);
    vehq.addEventListener('keydown',function(e){
      if(e.key!=='Enter')return;
      e.preventDefault();
      var res=searchVehicles(state.vehQuery,1);
      if(res.length) pickVehicle(res[0].marque,res[0].modele,res[0].gab);
      else { state.vehUnknown=true; render(); }
    });
  }
  document.addEventListener('click',function(e){
    if(acBox&&!e.target.closest('#ac')&&e.target.id!=='vehq') closeAc();
  });
  panel.querySelectorAll('[data-gab]').forEach(function(bt){bindCard(bt,function(){
    state.gab=bt.dataset.gab;state.gabAuto=false;
    logUnknownVehicle(state.vehQuery,state.gab);
    pushEvt({event:'vehicle_selected', vehicle_type:state.gab, vehicle_label:state.vehQuery||null, recognised:false});
    afterVehicle();
  })});
  var noModel=document.getElementById('noModel');
  if(noModel)noModel.addEventListener('click',function(){state.vehUnknown=true;render();});
  var vehReset=document.getElementById('vehReset');
  if(vehReset)vehReset.addEventListener('click',function(){
    state.marque='';state.modele='';state.gab=null;state.gabAuto=false;
    state.vehUnknown=false;state.vehQuery='';
    render();
    setTimeout(function(){var i=document.getElementById('vehq');if(i)i.focus();},40);
  });

  bindCommon();
  var next=document.getElementById('next');
  if(next)next.addEventListener('click',function(){
    if(!validPrestationStep()){shakeNext();return;}
    /* Question à réponses multiples : « Continuer » vaut validation. */
    if(step===1&&state.need==='quiz'){
      state.quizIdx++;
      if(state.quizIdx>=quizSteps().length) finishQuiz();
      navDirection='fwd';render();return;
    }
    if(step<last){step++;navDirection='fwd';render()}else{done()}
  });
  refreshSlotAvailability();
}

/* Interroge la disponibilité réelle des créneaux (réservations déjà en
   base pour ce service et ce jour) pour ce même jour, une fois choisi —
   les créneaux déjà pris sont grisés et non cliquables, jamais affichés
   comme libres par défaut. */
function refreshSlotAvailability(){
  if(state.type!=='prestation'||!state.jourISO)return;
  var wrap=document.getElementById('heureChips');
  if(!wrap)return;
  var svc=serviceId(), date=state.jourISO;
  fetch('/api/slots?service='+encodeURIComponent(svc)+'&date='+encodeURIComponent(date))
    .then(function(r){return r.ok?r.json():null;})
    .then(function(data){
      if(!data||!data.slots)return;
      var avail=data.slots;
      var w=document.getElementById('heureChips');
      if(!w)return;
      w.querySelectorAll('[data-t]').forEach(function(b){
        b.classList.toggle('taken', avail.indexOf(b.dataset.t)===-1);
      });
      if(state.heure && avail.indexOf(state.heure)===-1){
        state.heure=null;
        render();
      }
    })
    .catch(function(){});
}
function renderPhotoList(){
  var list=document.getElementById('photoList');
  if(!list) return;
  list.innerHTML=state.photos.map(function(f,i){
    return '<div class="photo-chip"><span>'+f.name+'</span><button type="button" data-rmphoto="'+i+'">✕</button></div>';
  }).join('');
  list.querySelectorAll('[data-rmphoto]').forEach(function(b){
    b.addEventListener('click',function(){state.photos.splice(+b.dataset.rmphoto,1);renderPhotoList();});
  });
}

function bindJ(last){
  panel.querySelectorAll('[data-pj]').forEach(function(b){b.addEventListener('click',function(){var i=+b.dataset.pj;var k=state.projet.indexOf(i);if(k>-1)state.projet.splice(k,1);else state.projet.push(i);render()})});
  panel.querySelectorAll('[data-m]').forEach(function(b){b.addEventListener('click',function(){state.mode=b.dataset.m;render()})});
  function bI(id,key){var el=document.getElementById(id);if(el)el.addEventListener('input',function(e){state[key]=e.target.value;})}
  bI('marque','marque');bI('modele','modele');bI('nom','nom');bI('tel','tel');bI('email','email');bI('msg','msg');
  var photoInput=document.getElementById('photoInput');
  if(photoInput){
    photoInput.addEventListener('change',function(){
      var incoming=[].slice.call(photoInput.files);
      incoming.forEach(function(f){
        if(state.photos.length>=3) return;
        if(f.size>6*1024*1024){showError('Photo trop lourde (6 Mo max) : '+f.name);return;}
        state.photos.push(f);
      });
      photoInput.value='';
      renderPhotoList();
    });
  }
  renderPhotoList();
  bindCommon();
  var next=document.getElementById('next');
  if(next)next.addEventListener('click',function(){
    if(!validProjetStep()){shakeNext();return;}
    if(step<last){step++;navDirection='fwd';render()}else{done()}
  });
}

render();

/* Le prix du Car Staging est centralisé côté serveur (catalogue de
   prestations, éditable depuis l'admin) — 600 € ci-dessus n'est qu'un
   repli affiché le temps que l'appel réponde, ou s'il échoue. */
fetch('/api/public/pricing/car-staging').then(function(r){return r.ok?r.json():null;}).then(function(d){
  if(d&&d.priceCents>0){STAGING.prix=Math.round(d.priceCents/100);render();}
}).catch(function(){});

/* Pré-remplissage du flux "projet" quand on arrive depuis une page SEO
   dédiée (ex. rendez-vous.html?projet=car-staging) — réutilise goToProjet()
   et le tableau projets déjà existants, aucun nouveau système. */
(function(){
  var wanted=new URLSearchParams(location.search).get('projet');
  if(!wanted) return;
  var map={'car-staging':'Car Staging','ceramique':'Traitement céramique','ppf':'PPF','vitres-teintees':'Vitres teintées','wrap':'Covering'};
  var label=map[wanted];
  if(!label) return;
  var idx=projets.findIndex(function(p){return p.label.indexOf(label)===0;});
  if(idx>-1) goToProjet(idx);
})();

/* ============================================================
   CTA COLLANT MOBILE — évolue avec l'avancée du tunnel, masqué
   quand le bouton "Continuer" est déjà visible à l'écran.
   ============================================================ */
var stickyEl=document.getElementById('lpSticky'), stickyCta=document.getElementById('lpStickyCta'),
    stickyCall=document.getElementById('lpStickyCall'), stickyRecap=document.getElementById('lpStickyRecap'),
    stickyVeh=document.getElementById('lpStickyVeh'), stickyPrice=document.getElementById('lpStickyPrice');
function inTunnel(){return state.type==='prestation'&&step>=2&&!!state.gab;}
function updateSticky(){
  if(!stickyEl||!stickyCta) return;
  var tunnel=inTunnel();
  if(stickyCall) stickyCall.hidden=tunnel;
  if(stickyRecap) stickyRecap.hidden=!tunnel;
  if(tunnel){
    var price=grandTotal()||basePrice();
    if(stickyVeh) stickyVeh.textContent=vehLabel()||GABARITS[state.gab].label;
    if(stickyPrice) stickyPrice.textContent=price>0?(price+' €'):'sur devis';
    stickyCta.textContent='Continuer';
  } else {
    stickyCta.textContent=state.type==='prestation'?'Configurer mon soin':'Continuer ma demande';
  }
  refreshStickyVisibility();
}
/* La barre ne doit jamais recouvrir le vrai bouton « Continuer » ni le
   calendrier : elle s'efface dès que l'un des deux est à l'écran. */
function refreshStickyVisibility(){
  if(!stickyEl) return;
  var hero=document.querySelector('.phero');
  var pastHero=window.scrollY>((hero?hero.offsetHeight:400)*0.85);
  var hide=false;
  ['next','calWrap'].forEach(function(id){
    var el=document.getElementById(id);
    if(!el) return;
    var r=el.getBoundingClientRect();
    if(r.top<window.innerHeight-24&&r.bottom>0) hide=true;
  });
  stickyEl.classList.toggle('on', pastHero&&!hide);
}
addEventListener('scroll',refreshStickyVisibility,{passive:true});
addEventListener('resize',refreshStickyVisibility);
if(stickyCta)stickyCta.addEventListener('click',function(e){
  e.preventDefault();
  var panelEl=document.getElementById('panel');
  if(panelEl)panelEl.scrollIntoView({behavior:'smooth',block:'center'});
});

/* Détail du récapitulatif sur mobile — feuille glissante, fermée par
   défaut, qui ne masque jamais le parcours. */
var sheet=document.getElementById('recapSheet');
if(stickyRecap&&sheet){
  var sheetBody=document.getElementById('recapSheetBody');
  var closeSheet=function(){sheet.hidden=true;};
  stickyRecap.addEventListener('click',function(){
    if(sheetBody) sheetBody.innerHTML='<div class="ws-title mono">Votre REYCE</div>'+recapHtml();
    sheet.hidden=false;
  });
  sheet.addEventListener('click',function(e){
    if(e.target===sheet||e.target.closest('[data-sheet-close]')) closeSheet();
  });
  addEventListener('keydown',function(e){if(e.key==='Escape')closeSheet();});
}
updateSticky();

/* ============================================================
   LANDING DYNAMIQUE GOOGLE ADS
   rendez-vous.html?service=interieur | exterieur | complet |
   confort | premium | experience — pré-oriente le parcours sans
   jamais bloquer le choix : tout reste modifiable ensuite.
   ============================================================ */
(function(){
  var want=(new URLSearchParams(location.search).get('service')||'').toLowerCase();
  if(!want) return;
  var areas={interieur:'interieur','interieur':'interieur',exterieur:'exterieur',complet:'duo',duo:'duo'};
  var tiers={confort:0,premium:1,experience:2,'expérience':2};
  var touched=false;
  if(Object.prototype.hasOwnProperty.call(areas,want)){state.clean=areas[want];touched=true;}
  if(Object.prototype.hasOwnProperty.call(tiers,want)){state.form=tiers[want];touched=true;}
  if(touched){state.need='direct';render();}
})();

})();
