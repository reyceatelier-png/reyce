/* REYCE — assistant de réservation simplifié : un seul écran de départ, nettoyage réservable, le reste sur devis */
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


/* Code promo — réservé aux formules Premium & Expérience */
var PROMO={active:true, code:'BIENVENUE10', rate:0.10, until:'31 août 2026', formules:['Premium','Expérience']};

/* ============================================================
   TRACKING GOOGLE ADS / GTM / GA4
   booking_complete (soin réservé) et generate_lead (demande de devis)
   ne partent qu'après confirmation réelle du serveur, jamais au clic.
   ============================================================ */
window.dataLayer=window.dataLayer||[];
function pushEvt(o){try{window.dataLayer.push(o);}catch(e){}}
var _bookingStarted=false;
function trackBookingStart(){
  if(_bookingStarted)return;_bookingStarted=true;
  pushEvt({event:'booking_start', booking_type:state.type});
}

/* UTM / gclid — capturés à l'arrivée, transmis à la page de remerciement
   et ajoutés aux notes pour l'attribution côté admin. */
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

/* Créneaux — la grille horaire ET les disponibilités viennent du serveur
   (ouverture du lundi au samedi, arrivées de 09:00 à 19:00, chaque
   rendez-vous mobilisant l'atelier au moins 3 h). */
var slotState={date:null, svc:null, all:[], free:[], closed:null, loading:false};
function slotChips(){
  if(!state.jourISO) return '';
  if(slotState.loading&&!slotState.all.length) return '<span class="slot-loading mono">Recherche des disponibilités…</span>';
  return slotState.all.map(function(t){
    var free=slotState.free.indexOf(t)>-1, sel=state.heure===t;
    return '<div class="chip'+(sel?' sel':'')+(free?'':' taken')+'" data-t="'+t+'" role="radio"'+
           ' tabindex="'+(free?'0':'-1')+'" aria-checked="'+(sel?'true':'false')+'"'+
           ' aria-disabled="'+(free?'false':'true')+'">'+t+'</div>';
  }).join('');
}
function slotNote(){
  if(!state.jourISO) return 'Choisissez d\'abord un jour — l\'atelier reçoit du lundi au samedi.';
  if(slotState.loading) return '';
  if(slotState.closed==='weekend') return 'L\'atelier est fermé le dimanche : choisissez un jour entre lundi et samedi.';
  if(slotState.closed) return 'Aucun créneau ce jour-là. Choisissez une autre date.';
  if(!slotState.free.length) return 'Toutes les arrivées de ce jour sont déjà réservées. Choisissez une autre date.';
  return 'Un rendez-vous mobilise l\'atelier au moins 3 heures : les horaires grisés sont déjà pris.';
}
function paintSlots(){
  var w=document.getElementById('heureChips');
  if(w){w.innerHTML=slotChips();bindSlotChips();}
  var n=document.getElementById('slotNote');
  if(n)n.textContent=slotNote();
}
function bindSlotChips(){
  var w=document.getElementById('heureChips');
  if(!w) return;
  w.querySelectorAll('[data-t]').forEach(function(b){bindCard(b,function(){
    if(b.classList.contains('taken'))return;
    state.heure=b.dataset.t;
    pushEvt({event:'slot_selected', slot_time:state.heure, slot_date:state.jourISO});
    render();
  })});
}

/* ============================================================
   PARCOURS UNIQUE
   Écran 1 : le client coche ce qu'il souhaite et indique son véhicule.
   • Nettoyage seul   -> Soin (tarif exact) -> Créneau + coordonnées
   • Tout le reste    -> Demande (détails + coordonnées) -> devis
   ============================================================ */
var SERV=[
  {k:'nettoyage', label:'Nettoyage & entretien', sub:'Intérieur, extérieur ou complet, au tarif de votre véhicule', tag:'Réservation immédiate'},
  {k:'ppf',       label:'PPF',                   sub:'Film de protection de la peinture', tag:'Sur devis'},
  {k:'ceramique', label:'Céramique',             sub:'Protection durable, brillance et entretien facilité', tag:'Sur devis'},
  {k:'polissage', label:'Polissage',             sub:'Correction du vernis, micro-rayures effacées', tag:'Sur devis'},
  {k:'covering',  label:'Covering',              sub:'Changement de teinte ou de finition', tag:'Sur devis'},
  {k:'vitres',    label:'Vitres teintées',       sub:'Film teinté, teinte au choix', tag:'Sur devis'},
  {k:'jantes',    label:'Rénovation de jantes',  sub:'Décapage, réparation et remise en peinture', tag:'Sur devis'},
  {k:'staging',   label:'Car Staging',           sub:'Remise à neuf en une journée', tag:'Sur devis'},
  {k:'autre',     label:'Autre projet',          sub:'Dites-nous ce que vous avez en tête', tag:'Sur devis'}
];
function svcLabel(k){for(var i=0;i<SERV.length;i++){if(SERV[i].k===k)return SERV[i].label;}return k;}

var LAB={
  prestation:['Besoin','Soin','Créneau'],
  projet:['Besoin','Demande']
};

var today=new Date();
function freshState(){
  return {type:'projet',sel:[],clean:'duo',form:1,marque:'',modele:'',gab:null,gabAuto:false,
          vehQuery:'',vehUnknown:false,opts:[],optsOpen:false,promo:false,
          calYear:today.getFullYear(),calMonth:today.getMonth(),jourISO:null,jourLabel:null,heure:null,
          photos:[],etat:'',prenom:'',nomFam:'',tel:'',email:'',msg:''};
}
var state=freshState();
var step=0;
/* Le type de parcours se déduit du choix : nettoyage seul = réservation
   immédiate, tout autre choix = demande de devis. */
function syncType(){state.type=(state.sel.length===1&&state.sel[0]==='nettoyage')?'prestation':'projet';}
syncType();
var MONTHS_FR=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

/* booking_start : première interaction réelle avec l'assistant. */
document.addEventListener('click',function(e){
  if(!_bookingStarted && e.target.closest('.resa')) trackBookingStart();
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
    var wd=dateObj.getDay();
    var weekend=(wd===0);
    var mut=dateObj<t0||weekend;
    h+='<div class="d'+(mut?' mut':'')+(weekend?' closed':'')+(state.jourISO===iso?' sel':'')+'" '+
       (mut?(weekend?'title="Fermé le dimanche"':''):'data-iso="'+iso+'" data-label="'+d+' '+MONTHS_FR[state.calMonth]+'"')+'>'+d+'</div>';
  }
  h+='</div><p class="cal-legend mono">Du lundi au samedi · arrivées de 09:00 à 19:00</p>';
  return h;
}

/* prix courant sélectionné (avant promo) — seul endroit qui calcule un prix
   de formule : « sportive » = base citadine + supplément dédié. */
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
  function stepFn(ts){
    if(!t0)t0=ts;
    var p=Math.min((ts-t0)/dur,1);
    var eased=1-Math.pow(1-p,3);
    el.textContent=Math.round(start+(target-start)*eased);
    if(p<1)requestAnimationFrame(stepFn);else el.textContent=target;
  }
  requestAnimationFrame(stepFn);
}

function updateWizMedia(){
  var key=state.type+'-'+step;
  document.querySelectorAll('.wiz-media .wm').forEach(function(img){
    img.classList.toggle('active', img.dataset.key===key);
  });
}

/* Cohérence des promesses : un nettoyage est confirmé immédiatement sur un
   créneau réellement disponible ; le reste est une demande de devis. */
var ASIDE_TXT={
  prestation:['Nettoyage et entretien : le tarif dépend du véhicule, le créneau est confirmé tout de suite.',
    'Trois niveaux de soin, au tarif exact de votre véhicule.',
    'Créneau confirmé immédiatement, règlement sur place.'],
  projet:['PPF, céramique, polissage… : dites-nous ce qu\'il vous faut et pour quel véhicule.',
    'Nous revenons vers vous sous 24 h avec une proposition chiffrée.']
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
/* Récapitulatif : le véhicule reste visible pendant tout le parcours. */
function recapHtml(){
  var f=CLEAN[state.clean].formules[state.form];
  var h='<div class="ws-veh"><div><span class="ws-k">Véhicule</span>'+
        '<b>'+(vehLabel()||'À renseigner')+'</b>'+
        (state.gab?'<span class="ws-gab">'+GABARITS[state.gab].label+'</span>':'')+'</div>'+
        (state.gab?'<button type="button" class="ws-edit" data-goto="0">Modifier</button>':'')+'</div>';
  if(step<1) return h;
  h+='<div class="ws-rows">';
  h+='<div class="ws-row"><span>Soin</span><b>'+f.k+'</b></div>';
  h+='<div class="ws-row"><span>Prestation</span><b>'+CLEAN[state.clean].label+'</b></div>';
  var vis=visibleOptions();
  var chosen=state.opts.map(function(id){return vis.find(function(o){return o.id===id});}).filter(Boolean);
  if(chosen.length) h+='<div class="ws-row"><span>Options</span><b>'+chosen.map(function(o){return o.nom;}).join(', ')+'</b></div>';
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
  var prows='';
  if(state.sel.length){prows+='<div class="ws-row"><span>Souhait</span><b>'+state.sel.map(svcLabel).join(', ')+'</b></div>';}
  if(vehLabel()){prows+='<div class="ws-row"><span>Véhicule</span><b>'+vehLabel()+'</b></div>';}
  if(!prows||step<1){el.innerHTML='';el.style.display='none';return;}
  el.innerHTML=prows;
  el.style.display='block';
}

function needGab(){return state.type==='prestation';}

function render(){
  syncType();
  var L=LAB[state.type];
  if(step>=L.length) step=L.length-1;
  renderSteps();updateWizMedia();updateProgress();
  var h='';
  asideTitle.textContent=!state.sel.length?'Que souhaitez-vous ?':(state.type==='prestation'?'Composez votre soin.':'Parlons de votre projet.');
  asideText.textContent=ASIDE_TXT[state.type][step]||ASIDE_TXT[state.type][0];
  updateAsideSummary();
  var head='<div class="plabel"><span class="mono">Étape 0'+(step+1)+' / 0'+L.length+'</span><span class="mono">'+L[step]+'</span></div>';
  var last=L.length-1;

  /* ---------- 01 · BESOIN + VÉHICULE (écran unique) ---------- */
  if(step===0){
    h+=head+'<h4>Que souhaitez-vous faire ?</h4>';
    h+='<p class="veh-note" style="margin-bottom:16px">Cochez une ou plusieurs prestations. Le nettoyage se réserve en ligne ; le reste se chiffre sur votre véhicule.</p>';
    h+='<div class="qopts qopts--grid" id="svcbox" role="group" aria-label="Prestations souhaitées">';
    SERV.forEach(function(s){
      var on=state.sel.indexOf(s.k)>-1;
      h+='<button type="button" class="qopt'+(on?' sel':'')+'" data-svc="'+s.k+'" aria-pressed="'+(on?'true':'false')+'">'+
         '<span class="qo-mark">'+(on?'✓':'')+'</span>'+
         '<span class="qo-body"><b>'+s.label+'</b><span>'+s.sub+'</span></span>'+
         '<span class="qo-tag">'+s.tag+'</span></button>';
    });
    h+='</div>';

    h+='<h4 style="margin-top:34px">Votre véhicule</h4><div id="vehbox">';
    if(state.gab&&!state.vehUnknown&&state.gabAuto){
      h+='<div class="veh-picked"><div class="vp-main"><span class="mono">Véhicule identifié</span>'+
         '<b>'+vehLabel()+'</b><span class="vp-cat">'+GABARITS[state.gab].label+'</span></div>'+
         '<button type="button" class="btn-line" id="vehReset">Modifier</button></div>';
      if(needGab()) h+='<p class="veh-note">Le tarif affiché ensuite correspondra exactement à ce gabarit.</p>';
    } else if(state.vehUnknown){
      h+='<div class="veh-unknown">'+
         (state.vehQuery?'<span class="mono">Modèle non identifié</span><p><b>'+state.vehQuery.replace(/</g,'&lt;')+'</b> ne figure pas encore dans notre base.</p>'
                        :'<span class="mono">Gabarit du véhicule</span><p>Indiquez le gabarit de votre véhicule.</p>')+
         '<p class="vu-sub">C\'est lui qui détermine le tarif du nettoyage.</p></div>';
      h+='<div class="qopts" id="gabbox" role="radiogroup" aria-label="Gabarit du véhicule">';
      for(var gk in GABARITS){
        var gsel=state.gab===gk;
        h+='<button type="button" role="radio" aria-checked="'+(gsel?'true':'false')+'" class="qopt'+(gsel?' sel':'')+'" data-gab="'+gk+'">'+
           '<span class="qo-mark">'+(gsel?'✓':'')+'</span>'+
           '<span class="qo-body"><b>'+GABARITS[gk].label+'</b><span>'+GABARITS[gk].desc+'</span></span></button>';
      }
      h+='</div><p class="veh-back"><button type="button" class="link-soft" id="vehReset">Rechercher un autre modèle</button></p>';
    } else {
      h+='<div class="vehsearch"><div class="field">'+
         '<label for="vehq">Marque ou modèle</label>'+
         '<input id="vehq" autocomplete="off" placeholder="BMW X3 M, Clio, Cayenne, Model 3…" value="'+(state.vehQuery||'').replace(/"/g,'&quot;')+'">'+
         '<div class="ac" id="ac"></div></div></div>'+
         '<p class="veh-note">Tapez les premières lettres et choisissez votre modèle dans la liste.'+
         (needGab()?' <button type="button" class="link-soft" id="noModel">Je ne le trouve pas : choisir le gabarit</button>':'')+'</p>';
    }
    h+='</div>';
  }
  /* ---------- NETTOYAGE · 02 SOIN ---------- */
  else if(state.type==='prestation'&&step===1){
    var fs=CLEAN[state.clean].formules;
    h+=head+'<h4>Votre soin pour '+(vehLabel()||'votre véhicule')+'</h4>';
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
      var cls='formcard'+(state.form===i?' sel':'')+(f.reco?' reco':'')+(f.top?' top':'');
      var tag=f.top?'<span class="tag alt">Signature REYCE</span>':(f.reco?'<span class="tag">Le plus choisi</span>':'');
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
      if(sv){h+='<div class="eco">Le complet vous fait économiser '+sv.save+' €</div>';}
      h+='</div>';
    }
    /* Options : repliées par défaut — facultatives, jamais un écran à part. */
    h+='<details class="fdetail opt-fold" style="margin-top:22px"'+((state.opts.length||state.optsOpen)?' open':'')+'><summary><span>Ajouter une option (facultatif)'+(state.opts.length?' · '+state.opts.length+' choisie'+(state.opts.length>1?'s':''):'')+'</span><span class="pm"></span></summary>';
    h+='<div class="optgrid" style="margin-top:12px">';
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
    h+='</details>';
    h+='<div class="pricebar"><span class="lbl">Total estimé</span><span class="amt"><span id="amtNum" data-target="'+subTotal()+'">'+subTotal()+'</span> €</span></div>';
  }
  /* ---------- NETTOYAGE · 03 CRÉNEAU + COORDONNÉES ---------- */
  else if(state.type==='prestation'&&step===2){
    var f=CLEAN[state.clean].formules[state.form];
    h+=head;
    h+='<div class="tunnel-done"><span class="mono">Votre soin est configuré</span>'+
       '<b>'+f.k+' · '+CLEAN[state.clean].label+' · '+euroTxt(grandTotal())+'</b></div>';
    h+='<h4>Choisissez quand nous confier votre véhicule.</h4>';
    h+='<div id="calWrap">'+calendar()+'</div>'+
    '<div class="field" style="margin-top:24px"><label id="heureLbl">Heure d\'arrivée</label>'+
    '<div class="chips" id="heureChips" role="radiogroup" aria-labelledby="heureLbl">'+slotChips()+'</div>'+
    '<p class="slot-note" id="slotNote">'+slotNote()+'</p></div>';
    if(state.jourISO&&state.heure){
      h+='<div class="coord-block"><h4 style="margin-bottom:6px">Vos coordonnées</h4>'+
         '<p class="veh-note" style="margin-bottom:18px">Dernière étape — nous avons déjà tout le reste.</p>'+contactFields()+'</div>';
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
  /* ---------- DEMANDE DE DEVIS · 02 DEMANDE ---------- */
  else {
    h+=head+'<h4>Votre demande</h4>';
    h+='<div class="recap" style="margin-bottom:24px">'+
       '<div class="rl"><span>Souhait</span><b>'+state.sel.map(svcLabel).join(', ')+'</b></div>'+
       '<div class="rl"><span>Véhicule</span><b>'+(vehLabel()||'—')+'</b></div></div>';
    h+='<div class="field"><label id="etatLbl">Votre véhicule est…</label><div class="chips" id="etatChips" role="radiogroup" aria-labelledby="etatLbl">'+
       ['Neuf','D\'occasion'].map(function(x){var v=x==='Neuf'?'neuf':'occasion';return '<div class="chip'+(state.etat===v?' sel':'')+'" data-etat="'+v+'" role="radio" tabindex="0" aria-checked="'+(state.etat===v?'true':'false')+'">'+x+'</div>';}).join('')+'</div></div>';
    h+='<div class="field"><label for="msg">Un détail à nous préciser ? (facultatif)</label>'+
       '<textarea id="msg" placeholder="Couleur, état de la peinture, finition souhaitée, délai…">'+(state.msg||'').replace(/</g,'&lt;')+'</textarea></div>';
    h+='<div class="field"><label>Photos du véhicule (facultatif — 3 max)</label>'+
       '<label class="photo-drop" id="photoDrop"><input type="file" id="photoInput" accept="image/*" multiple style="display:none"><span>Cliquez pour ajouter des photos</span></label>'+
       '<div class="photo-list" id="photoList"></div></div>';
    h+='<h4 style="margin-top:30px;margin-bottom:6px">Vos coordonnées</h4>'+
       '<p class="veh-note" style="margin-bottom:18px">Nous revenons vers vous sous 24 h avec une proposition chiffrée.</p>'+contactFields();
  }

  var lastLabel=state.type==='prestation'?(STRIPE_ENABLED?'Payer l\'acompte et confirmer':'Confirmer le rendez-vous'):'Envoyer ma demande';
  h+='<div class="pnav"><button type="button" class="btn ghost" id="back" '+(step===0?'style="visibility:hidden"':'')+'>← Retour</button>'+
     '<button type="button" class="btn" id="next">'+(step===last?lastLabel:'Continuer →')+'</button></div>';
  setPanel(h);bindAll(last);animateAmt();updateSticky();
}

function contactFields(){
  function v(x){return (x||'').replace(/"/g,'&quot;');}
  return '<div class="row2">'+
    '<div class="field"><label for="prenom">Prénom</label><input id="prenom" autocomplete="given-name" placeholder="Prénom" value="'+v(state.prenom)+'"></div>'+
    '<div class="field"><label for="nomFam">Nom</label><input id="nomFam" autocomplete="family-name" placeholder="Nom" value="'+v(state.nomFam)+'"></div>'+
  '</div><div class="row2">'+
    '<div class="field"><label for="tel">Téléphone</label><input id="tel" type="tel" autocomplete="tel" placeholder="06 …" value="'+v(state.tel)+'"></div>'+
    '<div class="field"><label for="email">Email</label><input id="email" type="email" autocomplete="email" placeholder="vous@email.com" value="'+v(state.email)+'"></div>'+
  '</div>';
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
    err.setAttribute('role','alert');
    err.style.cssText='color:#fff;background:rgba(255,255,255,.08);border:1px solid var(--line);padding:12px 16px;margin-top:14px;font-size:.85rem';
    panel.appendChild(err);
  }
  err.textContent=msg;
  try{err.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){}
}

/* Résumé lisible des options sélectionnées — stocké dans les notes de
   réservation. Le prix facturé est toujours recalculé côté serveur à
   partir des ids d'options : le client n'envoie jamais de montant. */
function optsNotes(){
  var vis=visibleOptions();
  var chosen=state.opts.map(function(id){return vis.find(function(o){return o.id===id});}).filter(Boolean);
  if(!chosen.length) return undefined;
  return 'Options : '+chosen.map(function(o){return o.nom;}).join(', ');
}

function done(){
  var next=document.getElementById('next');
  if(state.type==='prestation'){
    if(next){next.disabled=true;next.textContent=STRIPE_ENABLED?'Redirection vers le paiement…':'Confirmation…';}
    var f=CLEAN[state.clean].formules[state.form];
    var notesParts=[optsNotes(),utmNoteLine()].filter(Boolean);
    var payload={
      service: serviceId(),
      vehicleType: state.gab,
      vehicleModel: vehLabel(),
      date: state.jourISO,
      time: state.heure,
      client: {firstName:(state.prenom||'').trim(), lastName:(state.nomFam||'').trim(), phone:state.tel, email:state.email, notes: notesParts.length?notesParts.join(' — '):undefined},
      opts: state.opts
    };
    var url='/api/create-booking';
    if(STRIPE_ENABLED){url='/api/create-checkout-session';payload.paymentType='deposit';}
    fetch(url,{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
      .then(function(r){return r.json();})
      .then(function(data){
        if(data.error){showError(data.error,STRIPE_ENABLED?'Payer l\'acompte et confirmer':'Confirmer le rendez-vous');return;}
        if(data.url){window.location.href=data.url;return;}
        if(data.sessionId){
          /* booking_complete : déclenchée uniquement ici, après confirmation
             réelle côté serveur, jamais au clic. */
          pushEvt({
            event:'booking_complete', service:serviceId(), formula:f.k,
            service_area:state.clean, clean_type:state.clean,
            vehicle_type:state.gab, vehicle_label:vehLabel()||null,
            journey:'direct', value:grandTotal(), currency:'EUR'
          });
          var qs='session_id='+encodeURIComponent(data.sessionId);
          var utm=utmQueryString();
          if(utm)qs+='&'+utm;
          setTimeout(function(){window.location.href='/confirmation.html?'+qs;},250);
        }
      })
      .catch(function(){showError('Erreur de connexion. Vérifiez votre réseau et réessayez.','Confirmer le rendez-vous');});
    return;
  }

  /* ---- demande de devis (PPF, céramique, polissage, autre…) ---- */
  if(next){next.disabled=true;next.textContent='Envoi…';}
  var labels=state.sel.map(svcLabel);
  var vehicleInfo=vehLabel();
  var parts=['Prestations souhaitées : '+labels.join(', ')];
  if(state.etat) parts.push('Véhicule '+(state.etat==='neuf'?'neuf':'d\'occasion'));
  if(state.msg.trim()) parts.push(state.msg.trim());
  var source='Rendez-vous en ligne (rendez-vous.html) | prestations='+state.sel.join(',');
  var utm=utmNoteLine(); if(utm) source+=' | '+utm.replace(/^Source : /,'');
  var subject='Demande de devis — '+labels.join(', ');
  var fn=(state.prenom||'').trim(), ln=(state.nomFam||'').trim();
  var ok=function(r){return r&&r.ok;};
  var onDone=function(good){
    if(!good){showError('L\'envoi a échoué. Réessayez dans un instant, ou appelez-nous au 07 63 00 43 85.','Envoyer ma demande');return;}
    pushEvt({event:'project_request_sent', projects:state.sel});
    var main=state.sel.filter(function(k){return k==='ppf'||k==='ceramique'||k==='polissage';});
    pushEvt({event:'generate_lead', service:main.length===1?main[0]:'rendez-vous', form_location:'rendez_vous',
             currency:'EUR', value:0, lead_source:'rendez-vous.html', link_location:'form', page_type:'rendez_vous',
             cible:'general', formule:state.sel.join(',')});
    var target='merci-devis.html?service='+encodeURIComponent(main.length===1?main[0]:'rendez-vous');
    setTimeout(function(){window.location.href=target;},250);
  };
  if(state.photos.length){
    var fd=new FormData();
    fd.append('firstName', fn); fd.append('lastName', ln);
    fd.append('email', state.email); fd.append('phone', state.tel);
    fd.append('subject', subject); fd.append('vehicleInfo', vehicleInfo);
    fd.append('message', parts.join('\n')); fd.append('source', source);
    state.photos.forEach(function(p){fd.append('photos', p);});
    fetch('/api/devis-photos',{method:'POST', body: fd}).then(function(r){onDone(ok(r));}).catch(function(){onDone(false);});
  } else {
    fetch('/api/contact',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({type:'devis', firstName:fn, lastName:ln, email:state.email, phone:state.tel,
        subject:subject, vehicleInfo:vehicleInfo, message:parts.join('\n'), source:source})
    }).then(function(r){onDone(ok(r));}).catch(function(){onDone(false);});
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
  var nextB=document.getElementById('calNext');
  if(nextB)nextB.onclick=function(){state.calMonth++;if(state.calMonth>11){state.calMonth=0;state.calYear++;}renderCalendarOnly();};
}
function bindDateCells(){
  document.querySelectorAll('[data-iso]').forEach(function(b){b.onclick=function(){state.jourISO=b.dataset.iso;state.jourLabel=b.dataset.label;navDirection=null;render();};});
}

function scrollToPanelTop(){
  var wrap=document.querySelector('.resa');
  if(!wrap) return;
  var top=wrap.getBoundingClientRect().top;
  if(top<0||top>window.innerHeight*0.6){
    try{window.scrollTo({top:window.scrollY+top-76,behavior:'smooth'});}catch(e){window.scrollTo(0,window.scrollY+top-76);}
  }
}
function goBack(){
  if(step>0){step--;navDirection='back';render();scrollToPanelTop();}
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
var EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validContact(){
  if(!(state.prenom||'').trim()) return fieldError('prenom','Merci d\'indiquer votre prénom.');
  if(!(state.nomFam||'').trim()) return fieldError('nomFam','Merci d\'indiquer votre nom.');
  if(!(state.tel||'').trim()) return fieldError('tel','Merci d\'indiquer un téléphone pour vous joindre.');
  if(!EMAIL_RE.test((state.email||'').trim())) return fieldError('email','Merci d\'indiquer une adresse email valide.');
  return true;
}
function validStep(){
  if(step===0){
    if(!state.sel.length){flashEl('svcbox');showError('Choisissez au moins une prestation.');return false;}
    if(state.type==='prestation'){
      if(!state.gab){flashEl('vehbox');showError('Indiquez votre véhicule pour afficher le tarif exact : choisissez votre modèle dans la liste, ou son gabarit.');return false;}
    } else if(!vehLabel()){
      return fieldError('vehq','Indiquez votre véhicule (marque et modèle).');
    }
    return true;
  }
  if(state.type==='prestation'&&step===2){
    if(!state.jourISO){flashEl('calWrap');showError('Choisissez un jour.');return false;}
    if(!state.heure){flashEl('heureChips');showError('Choisissez une heure d\'arrivée.');return false;}
    return validContact();
  }
  if(state.type==='projet'&&step===1) return validContact();
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

function renderPhotoList(){
  var list=document.getElementById('photoList');
  if(!list) return;
  list.innerHTML=state.photos.map(function(f,i){
    return '<div class="photo-chip"><span>'+f.name.replace(/</g,'&lt;')+'</span><button type="button" data-rmphoto="'+i+'" aria-label="Retirer la photo">✕</button></div>';
  }).join('');
  list.querySelectorAll('[data-rmphoto]').forEach(function(b){
    b.addEventListener('click',function(){state.photos.splice(+b.dataset.rmphoto,1);renderPhotoList();});
  });
}

function bindAll(last){
  /* ---- prestations cochées ---- */
  panel.querySelectorAll('[data-svc]').forEach(function(b){bindCard(b,function(){
    var k=b.dataset.svc, i=state.sel.indexOf(k);
    if(i>-1) state.sel.splice(i,1); else state.sel.push(k);
    pushEvt({event:'service_toggled', service:k, selected:i===-1});
    render();
  })});

  /* ---- champs texte ---- */
  function bI(id,key){var el=document.getElementById(id);if(el)el.addEventListener('input',function(e){
    state[key]=e.target.value; el.removeAttribute('aria-invalid');
    var err=document.getElementById('bookErr'); if(err)err.remove();
  })}
  bI('prenom','prenom');bI('nomFam','nomFam');bI('tel','tel');bI('email','email');bI('msg','msg');

  /* ---- véhicule : recherche unifiée marque + modèle ---- */
  var acBox=document.getElementById('ac');
  var vehq=document.getElementById('vehq');
  function closeAc(){ if(acBox){acBox.innerHTML='';acBox.classList.remove('on');} }
  function pickVehicle(marque,modele,gab){
    state.marque=marque;state.modele=modele;state.gab=gab;
    state.gabAuto=true;state.vehUnknown=false;state.vehQuery=(marque+' '+modele).trim();
    closeAc();
    pushEvt({event:'vehicle_selected', vehicle_type:gab, vehicle_label:state.vehQuery, recognised:true});
    render();
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
    vehq.addEventListener('input',function(e){
      state.vehQuery=e.target.value; state.gab=null; state.gabAuto=false; state.marque=''; state.modele='';
      vehq.removeAttribute('aria-invalid'); var er=document.getElementById('bookErr'); if(er)er.remove();
      suggest();
    });
    vehq.addEventListener('focus',suggest);
    vehq.addEventListener('keydown',function(e){
      if(e.key!=='Enter')return;
      e.preventDefault();
      var res=searchVehicles(state.vehQuery,1);
      if(res.length) pickVehicle(res[0].marque,res[0].modele,res[0].gab);
      else if(needGab()){ state.vehUnknown=true; render(); }
      else { closeAc(); }
    });
  }
  document.addEventListener('click',function(e){
    if(acBox&&!e.target.closest('#ac')&&e.target.id!=='vehq') closeAc();
  });
  panel.querySelectorAll('[data-gab]').forEach(function(bt){bindCard(bt,function(){
    state.gab=bt.dataset.gab;state.gabAuto=false;
    logUnknownVehicle(state.vehQuery,state.gab);
    pushEvt({event:'vehicle_selected', vehicle_type:state.gab, vehicle_label:state.vehQuery||null, recognised:false});
    render();
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

  /* ---- nettoyage : soin, options, promo, créneau ---- */
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
  panel.querySelectorAll('[data-opt]').forEach(function(b){b.addEventListener('click',function(){
    var id=b.dataset.opt, k=state.opts.indexOf(id);
    if(k>-1) state.opts.splice(k,1); else state.opts.push(id);
    state.optsOpen=true;
    pushEvt({event:'option_toggled', option:id, selected:k===-1});
    render();
  })});
  var promoBtn=document.getElementById('promoBtn');
  if(promoBtn)promoBtn.addEventListener('click',function(){
    var v=(document.getElementById('promoInput').value||'').trim().toUpperCase();
    var hint=document.getElementById('promoHint');
    if(v!==PROMO.code){ if(hint){hint.textContent='Code invalide.';hint.style.color='#fff';} return; }
    if(!promoEligible()){ if(hint){hint.textContent='Ce code est valable sur Premium et Expérience. Choisissez l\'une de ces formules pour en profiter.';hint.style.color='#fff';} return; }
    state.promo=true; render();
  });
  bindSlotChips();
  bindCalendarNav();
  bindDateCells();

  /* ---- demande de devis : état du véhicule, photos ---- */
  panel.querySelectorAll('[data-etat]').forEach(function(b){bindCard(b,function(){
    state.etat=(state.etat===b.dataset.etat)?'':b.dataset.etat; render();
  })});
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

  /* ---- navigation ---- */
  var back=document.getElementById('back');
  if(back)back.addEventListener('click',goBack);
  var nextBtn=document.getElementById('next');
  if(nextBtn)nextBtn.addEventListener('click',function(){
    if(!validStep()){shakeNext();return;}
    if(step<last){step++;navDirection='fwd';render();scrollToPanelTop();}else{done();}
  });
  refreshSlotAvailability();
}

/* Interroge le serveur pour le jour choisi : grille complète (`all`) et
   arrivées réellement réservables (`slots`). */
function refreshSlotAvailability(){
  if(state.type!=='prestation'||!state.jourISO)return;
  if(!document.getElementById('heureChips'))return;
  var svc=serviceId(), date=state.jourISO;
  if(slotState.date===date&&slotState.svc===svc&&!slotState.loading){paintSlots();return;}
  slotState.date=date;slotState.svc=svc;slotState.loading=true;
  paintSlots();
  fetch('/api/slots?service='+encodeURIComponent(svc)+'&date='+encodeURIComponent(date))
    .then(function(r){return r.ok?r.json():null;})
    .then(function(data){
      if(slotState.date!==date||slotState.svc!==svc)return; // réponse devenue obsolète
      slotState.loading=false;
      slotState.all=(data&&data.all)||[];
      slotState.free=(data&&data.slots)||[];
      slotState.closed=(data&&data.closed)||null;
      /* Le créneau retenu vient d'être pris par quelqu'un d'autre : on le
         retire plutôt que de laisser le client valider dans le vide. */
      if(state.heure&&slotState.free.indexOf(state.heure)===-1){state.heure=null;render();return;}
      paintSlots();
    })
    .catch(function(){slotState.loading=false;paintSlots();});
}

render();

/* ============================================================
   CTA COLLANT MOBILE — évolue avec l'avancée du parcours, masqué
   quand le bouton "Continuer" est déjà visible à l'écran.
   ============================================================ */
var stickyEl=document.getElementById('lpSticky'), stickyCta=document.getElementById('lpStickyCta'),
    stickyCall=document.getElementById('lpStickyCall'), stickyRecap=document.getElementById('lpStickyRecap'),
    stickyVeh=document.getElementById('lpStickyVeh'), stickyPrice=document.getElementById('lpStickyPrice');
function inTunnel(){return state.type==='prestation'&&step>=1&&!!state.gab;}
function updateSticky(){
  if(!stickyEl||!stickyCta) return;
  var tunnel=inTunnel();
  if(stickyCall) stickyCall.hidden=tunnel;
  if(stickyRecap) stickyRecap.hidden=!tunnel;
  if(tunnel){
    var price=grandTotal()||basePrice();
    if(stickyVeh) stickyVeh.textContent=vehLabel()||GABARITS[state.gab].label;
    if(stickyPrice) stickyPrice.textContent=price>0?(price+' €'):'sur devis';
    stickyCta.textContent=nextLabel();
  } else {
    stickyCta.textContent=(step>0||state.sel.length)?nextLabel():'Réserver / devis';
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
/* Libellé court du bouton principal de l'écran courant (Continuer, Confirmer, Envoyer). */
function nextLabel(){
  var L=LAB[state.type];
  if(step<L.length-1) return 'Continuer';
  return state.type==='prestation'?'Confirmer':'Envoyer';
}
/* La barre collante agit comme le bouton principal : un seul geste, jamais deux boutons différents. */
if(stickyCta)stickyCta.addEventListener('click',function(e){
  e.preventDefault();
  var nb=document.getElementById('next');
  if(nb&&!nb.disabled&&panel.contains(nb)&&(step>0||state.sel.length)){nb.click();return;}
  var panelEl=document.getElementById('panel');
  if(panelEl)panelEl.scrollIntoView({behavior:'smooth',block:'center'});
});

/* Détail du récapitulatif sur mobile — feuille glissante, fermée par défaut. */
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
   LIENS D'ARRIVÉE (annonces Google Ads, pages du site)
   rendez-vous.html?service=interieur | exterieur | complet |
     confort | premium | experience   → nettoyage pré-orienté
   rendez-vous.html?projet=ppf | ceramique | polissage | covering |
     vitres-teintees | jantes | car-staging  → prestation cochée
   Tout reste modifiable ensuite.
   ============================================================ */
(function(){
  var sp=new URLSearchParams(location.search);
  var want=(sp.get('service')||'').toLowerCase();
  var proj=(sp.get('projet')||'').toLowerCase();
  var touched=false;
  if(want){
    var areas={interieur:'interieur',exterieur:'exterieur',complet:'duo',duo:'duo'};
    var tiers={confort:0,premium:1,experience:2,'expérience':2};
    if(Object.prototype.hasOwnProperty.call(areas,want)){state.clean=areas[want];touched=true;}
    if(Object.prototype.hasOwnProperty.call(tiers,want)){state.form=tiers[want];touched=true;}
    if(touched&&state.sel.indexOf('nettoyage')===-1) state.sel.push('nettoyage');
  }
  if(proj){
    var map={'car-staging':'staging','staging':'staging','ceramique':'ceramique','ppf':'ppf','vitres-teintees':'vitres','vitres':'vitres',
             'wrap':'covering','covering':'covering','polissage':'polissage','jantes':'jantes','renovation-jantes':'jantes','nettoyage':'nettoyage'};
    if(Object.prototype.hasOwnProperty.call(map,proj)){
      if(state.sel.indexOf(map[proj])===-1) state.sel.push(map[proj]);
      touched=true;
    }
  }
  if(touched) render();
})();

})();
