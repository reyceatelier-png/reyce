/* REYCE — réservation en étapes : une question par écran, avance automatique */
(function(){
/* Le paiement Stripe (acompte) est mis en pause pour l'instant : le parcours
   se termine par un écran de confirmation local. Le code de paiement reste
   en place, prêt à être réactivé — repasser ce flag à true suffira. */
var STRIPE_ENABLED=false;
var panel=document.getElementById('panel');
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
   RÉSERVATION EN ÉTAPES — une question par écran, avance automatique
   Nettoyage : prestation → véhicule → zone → formule → jour → heure → coordonnées
   Autres    : prestation → (précision) → véhicule → détails → coordonnées
   ============================================================ */
window.dataLayer=window.dataLayer||[];
function pushEvt(o){try{window.dataLayer.push(o);}catch(e){}}
var _started=false;
function trackStart(){
  if(_started)return;_started=true;
  pushEvt({event:'booking_start', booking_type:flowType()});
}

/* UTM / gclid — capturés à l'arrivée, transmis à la page de remerciement et ajoutés aux notes. */
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

var MONTHS_FR=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
var EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

var SVC=[
  {k:'nettoyage', label:'Nettoyage & entretien', sub:'Intérieur, extérieur ou complet', tag:'Réservation immédiate', book:true},
  {k:'ppf',       label:'PPF',                   sub:'Film de protection de la peinture', tag:'Sur devis'},
  {k:'ceramique', label:'Céramique',             sub:'Protection durable et brillance', tag:'Sur devis'},
  {k:'polissage', label:'Polissage',             sub:'Correction du vernis', tag:'Sur devis'},
  {k:'autre',     label:'Autre prestation',      sub:'Covering, vitres teintées, jantes, Car Staging…', tag:'Sur devis'}
];
var AUTRE=[
  {k:'covering', label:'Covering',             sub:'Changement de teinte ou de finition'},
  {k:'vitres',   label:'Vitres teintées',      sub:'Film teinté, teinte au choix'},
  {k:'jantes',   label:'Rénovation de jantes', sub:'Décapage, réparation, remise en peinture'},
  {k:'staging',  label:'Car Staging',          sub:'Remise à neuf en une journée'},
  {k:'autre',    label:'Autre projet',         sub:'Dites-nous ce que vous avez en tête'}
];
function svcLabel(k){
  var i;for(i=0;i<SVC.length;i++){if(SVC[i].k===k)return SVC[i].label;}
  for(i=0;i<AUTRE.length;i++){if(AUTRE[i].k===k)return AUTRE[i].label;}
  return k;
}
var ZONES=[['interieur','Intérieur'],['exterieur','Extérieur'],['duo','Intérieur + Extérieur']];

var today=new Date();
function fresh(){
  return {svc:null,group:null,more:[],marque:'',modele:'',gab:null,gabAuto:false,vehQuery:'',vehUnknown:false,
          clean:null,form:null,opts:[],optsOpen:false,promo:false,promoOpen:false,
          calYear:today.getFullYear(),calMonth:today.getMonth(),jourISO:null,jourLabel:null,heure:null,
          photos:[],etat:'',prenom:'',nomFam:'',tel:'',email:'',msg:'',skip:{}};
}
var state=fresh();
var idx=0;
var navDirection=null;
function flowType(){return state.svc==='nettoyage'?'prestation':'projet';}

function stepsList(){
  var s=[];
  if(!state.skip.svc) s.push('svc');
  if(state.group==='autre') s.push('autre');
  s.push('veh');
  if(state.svc==='nettoyage'){
    if(!state.skip.zone) s.push('zone');
    if(!state.skip.form) s.push('formule');
    s.push('jour','heure','coord');
  } else s.push('details','coord');
  return s;
}

/* ---------- prix : moteur unique ---------- */
function priceFor(cleanKey,formIdx,gab){
  var f=CLEAN[cleanKey].formules[formIdx];
  if(!f||f.prix<=0)return 0;
  if(gab==='sportive')return f.prix+GABARITS.sportive.supp;
  var g=gab||'citadine';
  return (f.parGabarit&&f.parGabarit[g])||f.prix;
}
function formuleKey(f){return f.k==='Confort'?'confort':(f.k==='Premium'?'premium':'experience');}
function optsTotal(){var visible=visibleOptions();var t=0;state.opts.forEach(function(id){var o=visible.find(function(x){return x.id===id});if(o)t+=o.prix;});return t;}
function chosenForm(){return (state.clean&&state.form!==null)?CLEAN[state.clean].formules[state.form]:null;}
function promoEligible(){var f=chosenForm();return !!f&&PROMO.active&&PROMO.formules.indexOf(f.k)>-1;}
function basePrice(){if(flowType()!=='prestation'||!chosenForm())return 0;return priceFor(state.clean,state.form,state.gab);}
function subTotal(){var bp=basePrice();if(bp<=0)return 0;return bp+optsTotal();}
function grandTotal(){var st=subTotal();if(st<=0)return 0;return (state.promo&&promoEligible())?Math.round(st*(1-PROMO.rate)):st;}
function serviceId(){
  var f=chosenForm();
  var gabForPricing=state.gab==='sportive'?'citadine':(state.gab||'citadine');
  return 'nettoyage-'+CLEAN[state.clean].svc+'-'+formuleKey(f)+'-'+gabForPricing;
}
function vehLabel(){
  var v=(state.marque+' '+state.modele).trim();
  return v||(state.vehQuery||'').trim()||'';
}
function minPrice(zone){
  var m=0;CLEAN[zone].formules.forEach(function(f,i){var p=priceFor(zone,i,state.gab);if(p>0&&(m===0||p<m))m=p;});return m;
}

/* ---------- créneaux : grille et disponibilités viennent du serveur ---------- */
var slotState={date:null, svc:null, all:[], free:[], closed:null, loading:false};
function fetchSlots(cb){
  var svc=serviceId(), date=state.jourISO;
  slotState.date=date;slotState.svc=svc;slotState.loading=true;
  fetch('/api/slots?service='+encodeURIComponent(svc)+'&date='+encodeURIComponent(date))
    .then(function(r){return r.ok?r.json():null;})
    .then(function(data){
      if(slotState.date!==date||slotState.svc!==svc)return;
      slotState.loading=false;
      slotState.all=(data&&data.all)||[];
      slotState.free=(data&&data.slots)||[];
      slotState.closed=(data&&data.closed)||null;
      cb&&cb();
    })
    .catch(function(){slotState.loading=false;slotState.all=[];slotState.free=[];slotState.closed='error';cb&&cb();});
}
function slotNote(){
  if(slotState.closed==='weekend') return 'L\'atelier est fermé le dimanche : choisissez un jour entre lundi et samedi.';
  if(slotState.closed==='error') return 'Impossible de charger les disponibilités. Réessayez dans un instant.';
  if(slotState.closed) return 'Aucun créneau ce jour-là. Choisissez une autre date.';
  if(!slotState.free.length) return 'Toutes les arrivées de ce jour sont déjà réservées. Choisissez une autre date.';
  return '';
}

/* ---------- structure de l'écran ---------- */
var elBack=document.getElementById('wzBack'), elFill=document.getElementById('wzFill'),
    elCount=document.getElementById('wzCount'), elSum=document.getElementById('wzSum');

function setPanel(html){
  panel.classList.remove('panel-fade','panel-fwd','panel-back');
  void panel.offsetWidth;
  panel.innerHTML=html;
  panel.classList.add(navDirection==='fwd'?'panel-fwd':(navDirection==='back'?'panel-back':'panel-fade'));
  navDirection=null;
}
function passed(name){var L=stepsList(),i=L.indexOf(name);return i===-1?!!state.skip[name==='formule'?'form':name]:i<idx;}
function summaryText(){
  var parts=[], f=chosenForm();
  if(state.svc) parts.push(svcLabel(state.svc)+(state.more.length?' +'+state.more.length:''));
  if(vehLabel()&&passed('veh')) parts.push(vehLabel());
  if(state.svc==='nettoyage'){
    if(state.clean&&passed('zone')) parts.push(CLEAN[state.clean].label);
    if(f&&passed('formule')) parts.push(f.k);
    var cur=stepsList()[idx];
    if(state.jourLabel&&cur==='heure') parts.push(state.jourLabel);
    if(state.jourLabel&&state.heure&&cur==='coord') parts.push(state.jourLabel+' · '+state.heure);
    var gt=grandTotal(); if(f&&gt>0&&passed('formule')) parts.push(gt+' €');
  }
  return parts.join(' · ');
}
function goNext(){idx++;navDirection='fwd';render();scrollToStage();}
function goPrev(){if(idx>0){idx--;navDirection='back';render();scrollToStage();}}
function scrollToStage(){
  var st=document.getElementById('resa'); if(!st) return;
  var top=st.getBoundingClientRect().top;
  if(top<-4||top>window.innerHeight*0.5){try{window.scrollTo({top:window.scrollY+top-8,behavior:'smooth'});}catch(e){window.scrollTo(0,window.scrollY+top-8);}}
}

function render(){
  var L=stepsList(); if(idx>=L.length) idx=L.length-1; if(idx<0) idx=0;
  var name=L[idx];
  if(elBack) elBack.hidden=(idx===0);
  if(elFill) elFill.style.width=(((idx+1)/L.length)*100)+'%';
  if(elCount) elCount.textContent=state.svc||state.group?((idx+1)+' / '+L.length):'';
  var sum=idx>0?summaryText():'';
  if(elSum){elSum.hidden=!sum;elSum.textContent=sum;}
  setPanel(R[name]());
  (B[name]||function(){})();
}

/* ---------- petits utilitaires d'écran ---------- */
function showError(msg,resetBtn){
  var btn=document.getElementById('wzGo');
  if(btn&&resetBtn){btn.disabled=false;btn.textContent=resetBtn;}
  var err=document.getElementById('wzErr');
  if(!err){
    err=document.createElement('p');err.id='wzErr';err.className='wz-err';err.setAttribute('role','alert');
    panel.appendChild(err);
  }
  err.textContent=msg;
  try{err.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){}
}
function clearError(){var e=document.getElementById('wzErr');if(e)e.remove();}
function flash(id){var el=document.getElementById(id);if(!el)return;el.classList.remove('field-flash');void el.offsetWidth;el.classList.add('field-flash');}
function fieldError(id,msg){
  flash(id);var el=document.getElementById(id);
  if(el){el.setAttribute('aria-invalid','true');try{el.focus();}catch(e){}}
  showError(msg);return false;
}
function validContact(){
  if(!(state.prenom||'').trim()) return fieldError('prenom','Merci d\'indiquer votre prénom.');
  if(!(state.nomFam||'').trim()) return fieldError('nomFam','Merci d\'indiquer votre nom.');
  if(!(state.tel||'').trim()) return fieldError('tel','Merci d\'indiquer un téléphone pour vous joindre.');
  if(!EMAIL_RE.test((state.email||'').trim())) return fieldError('email','Merci d\'indiquer une adresse email valide.');
  return true;
}
function bindInputs(){
  ['prenom','nomFam','tel','email','msg'].forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.addEventListener('input',function(e){state[id]=e.target.value;el.removeAttribute('aria-invalid');clearError();});
  });
}
function contactFields(){
  return '<div class="row2">'+
    '<div class="field"><label for="prenom">Prénom</label><input id="prenom" autocomplete="given-name" placeholder="Prénom" value="'+esc(state.prenom)+'"></div>'+
    '<div class="field"><label for="nomFam">Nom</label><input id="nomFam" autocomplete="family-name" placeholder="Nom" value="'+esc(state.nomFam)+'"></div>'+
  '</div><div class="row2">'+
    '<div class="field"><label for="tel">Téléphone</label><input id="tel" type="tel" autocomplete="tel" placeholder="06 …" value="'+esc(state.tel)+'"></div>'+
    '<div class="field"><label for="email">Email</label><input id="email" type="email" autocomplete="email" placeholder="vous@email.com" value="'+esc(state.email)+'"></div>'+
  '</div>';
}
function bindCard(el,fn){
  el.addEventListener('click',fn);
  el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '||e.key==='Spacebar'){e.preventDefault();fn();}});
}

var R={}, B={};

/* ================= 1 · PRESTATION ================= */
R.svc=function(){
  var h='<h2 class="wz-q">Que souhaitez-vous faire ?</h2><div class="wz-opts">';
  SVC.forEach(function(s){
    h+='<button type="button" class="wz-opt" data-svc="'+s.k+'"><span class="wz-t"><b>'+s.label+'</b><span>'+s.sub+'</span></span>'+
       '<span class="wz-tag'+(s.book?' book':'')+'">'+s.tag+'</span></button>';
  });
  return h+'</div>';
};
B.svc=function(){
  panel.querySelectorAll('[data-svc]').forEach(function(b){b.addEventListener('click',function(){
    var k=b.dataset.svc; trackStart();
    state.more=[];
    if(k==='autre'){state.group='autre';state.svc=null;}
    else{state.group=null;state.svc=k;}
    pushEvt({event:'service_selected', service:k});
    goNext();
  });});
};
/* ================= 1 bis · AUTRE PRESTATION ================= */
R.autre=function(){
  var h='<h2 class="wz-q">Quelle prestation ?</h2><div class="wz-opts">';
  AUTRE.forEach(function(s){h+='<button type="button" class="wz-opt" data-autre="'+s.k+'"><span class="wz-t"><b>'+s.label+'</b><span>'+s.sub+'</span></span></button>';});
  return h+'</div>';
};
B.autre=function(){
  panel.querySelectorAll('[data-autre]').forEach(function(b){b.addEventListener('click',function(){
    state.svc=b.dataset.autre;state.more=[];
    pushEvt({event:'service_selected', service:state.svc});
    goNext();
  });});
};

/* ================= 2 · VÉHICULE ================= */
R.veh=function(){
  var nett=state.svc==='nettoyage';
  var h='<h2 class="wz-q">Quel est votre véhicule ?</h2>';
  if(nett&&state.vehUnknown){
    h+='<p class="wz-note">'+(state.vehQuery?'<b>'+esc(state.vehQuery)+'</b> ne figure pas encore dans notre base. ':'')+'Indiquez son gabarit : c\'est lui qui détermine le tarif.</p><div class="wz-opts">';
    for(var gk in GABARITS){h+='<button type="button" class="wz-opt" data-gab="'+gk+'"><span class="wz-t"><b>'+GABARITS[gk].label+'</b><span>'+GABARITS[gk].desc+'</span></span></button>';}
    return h+'</div><p class="wz-link"><button type="button" class="link-soft" id="vehReset">Rechercher un autre modèle</button></p>';
  }
  h+='<div class="field wz-search"><label for="vehq">Marque ou modèle</label>'+
     '<input id="vehq" autocomplete="off" autocapitalize="words" placeholder="BMW M3, Clio, Cayenne, Model 3…" value="'+esc(state.vehQuery)+'">'+
     '<div class="wz-opts wz-sugg" id="ac"></div></div>';
  if(state.gab&&state.gabAuto) h+='<p class="wz-note" id="vehOk">Véhicule identifié : <b>'+esc(vehLabel())+'</b> · '+GABARITS[state.gab].label+'</p>';
  h+='<div class="wz-after"><button type="button" class="btn solid wz-cta" id="wzGo" hidden>Continuer</button>';
  if(nett) h+='<p class="wz-link"><button type="button" class="link-soft" id="noModel">Je ne trouve pas mon véhicule</button></p>';
  return h+'</div>';
};
B.veh=function(){
  var nett=state.svc==='nettoyage';
  var acBox=document.getElementById('ac'), vehq=document.getElementById('vehq'), go=document.getElementById('wzGo');
  function pick(marque,modele,gab){
    state.marque=marque;state.modele=modele;state.gab=gab;state.gabAuto=true;state.vehUnknown=false;
    state.vehQuery=(marque+' '+modele).trim();
    pushEvt({event:'vehicle_selected', vehicle_type:gab, vehicle_label:state.vehQuery, recognised:true});
    goNext();
  }
  function refreshGo(){
    if(!go) return;
    var txt=(state.vehQuery||'').trim();
    var res=txt.length>=2?searchVehicles(txt,1):[];
    var show=(!nett&&txt.length>=2)||(nett&&state.gab&&state.gabAuto);
    go.hidden=!show;
    if(show) go.textContent=(res.length||(state.gab&&state.gabAuto))?'Continuer':'Continuer avec « '+txt+' »';
  }
  function suggest(){
    if(!acBox) return;
    var res=searchVehicles(state.vehQuery,6);
    acBox.innerHTML=res.map(function(v){
      return '<button type="button" class="wz-opt" data-mk="'+esc(v.marque)+'" data-md="'+esc(v.modele)+'" data-gb="'+v.gab+'"><span class="wz-t"><b>'+esc(v.marque+' '+v.modele)+'</b></span><span class="wz-tag">'+GABARITS[v.gab].label+'</span></button>';
    }).join('');
    acBox.querySelectorAll('.wz-opt').forEach(function(bt){bt.addEventListener('click',function(){pick(bt.dataset.mk,bt.dataset.md,bt.dataset.gb);});});
  }
  if(vehq){
    vehq.addEventListener('input',function(e){
      state.vehQuery=e.target.value;state.gab=null;state.gabAuto=false;state.marque='';state.modele='';
      var ok=document.getElementById('vehOk');if(ok)ok.remove();clearError();
      suggest();refreshGo();
    });
    vehq.addEventListener('keydown',function(e){
      if(e.key!=='Enter')return; e.preventDefault();
      var res=searchVehicles(state.vehQuery,1);
      if(res.length) pick(res[0].marque,res[0].modele,res[0].gab);
      else if(nett){state.vehUnknown=true;render();}
      else if((state.vehQuery||'').trim().length>=2){goNext();}
    });
    if(state.vehQuery) suggest();
    if(!state.vehQuery){setTimeout(function(){try{vehq.focus({preventScroll:true});}catch(e){}},60);}
  }
  refreshGo();
  if(go) go.addEventListener('click',function(){
    if(state.gab&&state.gabAuto){goNext();return;}
    if((state.vehQuery||'').trim().length<2){fieldError('vehq','Indiquez votre véhicule (marque et modèle).');return;}
    var res=searchVehicles(state.vehQuery,1);
    if(res.length&&norm(res[0].full)===norm(state.vehQuery)){pick(res[0].marque,res[0].modele,res[0].gab);return;}
    goNext();
  });
  panel.querySelectorAll('[data-gab]').forEach(function(bt){bt.addEventListener('click',function(){
    state.gab=bt.dataset.gab;state.gabAuto=false;
    logUnknownVehicle(state.vehQuery,state.gab);
    pushEvt({event:'vehicle_selected', vehicle_type:state.gab, vehicle_label:state.vehQuery||null, recognised:false});
    goNext();
  });});
  var noModel=document.getElementById('noModel');
  if(noModel)noModel.addEventListener('click',function(){state.vehUnknown=true;render();});
  var vehReset=document.getElementById('vehReset');
  if(vehReset)vehReset.addEventListener('click',function(){
    state.marque='';state.modele='';state.gab=null;state.gabAuto=false;state.vehUnknown=false;state.vehQuery='';render();
  });
};

/* ================= 3 · ZONE (nettoyage) ================= */
R.zone=function(){
  var h='<h2 class="wz-q">Intérieur, extérieur ou les deux ?</h2><div class="wz-opts">';
  ZONES.forEach(function(z){
    h+='<button type="button" class="wz-opt'+(state.clean===z[0]?' sel':'')+'" data-zone="'+z[0]+'"><span class="wz-t"><b>'+z[1]+'</b>'+
       (z[0]==='duo'?'<span>Le véhicule repris dans son ensemble</span>':'')+'</span>'+
       '<span class="wz-right">'+(z[0]==='duo'?'<span class="wz-tag book">Recommandé</span>':'')+'<span class="wz-price"><i>dès</i> '+minPrice(z[0])+' €</span></span></button>';
  });
  return h+'</div>';
};
B.zone=function(){
  panel.querySelectorAll('[data-zone]').forEach(function(b){b.addEventListener('click',function(){
    state.clean=b.dataset.zone;
    pushEvt({event:'service_area_selected', service_area:state.clean, vehicle_type:state.gab});
    goNext();
  });});
};

/* ================= 4 · FORMULE (nettoyage) ================= */
R.formule=function(){
  var fs=CLEAN[state.clean].formules;
  var h='<h2 class="wz-q">Quelle formule ?</h2><div class="wz-opts wz-forms">';
  fs.forEach(function(f,i){
    var tag=f.top?'Signature REYCE':(f.reco?'Le plus choisi':'');
    var det='';
    if(f.detailInt&&f.detailExt){
      det='<details class="wz-det"><summary>Voir ce qui est inclus</summary><h5>Intérieur</h5><ul>'+f.detailInt.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ul><h5>Extérieur</h5><ul>'+f.detailExt.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ul></details>';
    } else if(f.detail){
      det='<details class="wz-det"><summary>Voir ce qui est inclus</summary><ul>'+f.detail.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ul></details>';
    }
    h+='<div class="wz-fcard'+(state.form===i?' sel':'')+(f.top?' top':'')+'" data-form="'+i+'" role="button" tabindex="0">'+
       '<div class="wz-fhead"><div><span class="wz-ftier">'+TIER_SUB[f.k]+'</span><b>'+f.nom+'</b></div>'+
       '<div class="wz-fprice">'+(tag?'<span class="wz-tag book">'+tag+'</span>':'')+'<span class="wz-price">'+priceFor(state.clean,i,state.gab)+' €</span></div></div>'+
       '<p class="wz-fpitch">'+f.pitch+'</p>'+det+'</div>';
  });
  return h+'</div>';
};
B.formule=function(){
  panel.querySelectorAll('.wz-det').forEach(function(d){d.addEventListener('click',function(e){e.stopPropagation();});});
  panel.querySelectorAll('[data-form]').forEach(function(b){bindCard(b,function(){
    state.form=+b.dataset.form;
    pushEvt({event:'formula_selected', formula:CLEAN[state.clean].formules[state.form].k,
             service_area:state.clean, vehicle_type:state.gab, value:grandTotal(), currency:'EUR'});
    goNext();
  });});
};

/* ================= 5 · JOUR (nettoyage) ================= */
function calendarHtml(){
  var dow=['L','M','M','J','V','S','D'];
  var h='<div class="cal-nav"><button type="button" class="cal-nav__btn" id="calPrev" aria-label="Mois précédent">‹</button><span class="mono">'+MONTHS_FR[state.calMonth]+' '+state.calYear+'</span><button type="button" class="cal-nav__btn" id="calNext" aria-label="Mois suivant">›</button></div><div class="cal">';
  dow.forEach(function(d){h+='<div class="dow">'+d+'</div>';});
  var first=new Date(state.calYear,state.calMonth,1), off=(first.getDay()+6)%7;
  var dim=new Date(state.calYear,state.calMonth+1,0).getDate();
  var t0=new Date();t0.setHours(0,0,0,0);
  for(var i=0;i<off;i++)h+='<div class="d mut"></div>';
  for(var d=1;d<=dim;d++){
    var dateObj=new Date(state.calYear,state.calMonth,d);
    var iso=state.calYear+'-'+String(state.calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var weekend=(dateObj.getDay()===0), mut=dateObj<t0||weekend;
    h+='<div class="d'+(mut?' mut':'')+(weekend?' closed':'')+(state.jourISO===iso?' sel':'')+'" '+
       (mut?(weekend?'title="Fermé le dimanche"':''):'data-iso="'+iso+'" data-label="'+d+' '+MONTHS_FR[state.calMonth]+'" role="button" tabindex="0"')+'>'+d+'</div>';
  }
  return h+'</div>';
}
R.jour=function(){
  return '<h2 class="wz-q">Quel jour ?</h2><div id="calWrap">'+calendarHtml()+'</div>'+
         '<p class="wz-note" id="slotNote">Du lundi au samedi · arrivées de 09:00 à 19:00</p>';
};
B.jour=function(){
  function bindCal(){
    var prev=document.getElementById('calPrev'), nxt=document.getElementById('calNext');
    if(prev)prev.onclick=function(){state.calMonth--;if(state.calMonth<0){state.calMonth=11;state.calYear--;}redraw();};
    if(nxt)nxt.onclick=function(){state.calMonth++;if(state.calMonth>11){state.calMonth=0;state.calYear++;}redraw();};
    document.querySelectorAll('#calWrap [data-iso]').forEach(function(c){bindCard(c,function(){
      state.jourISO=c.dataset.iso;state.jourLabel=c.dataset.label;state.heure=null;
      var note=document.getElementById('slotNote'); if(note)note.textContent='Recherche des disponibilités…';
      fetchSlots(function(){
        var msg=slotNote();
        if(msg){var n=document.getElementById('slotNote');if(n)n.textContent=msg;redraw(true);return;}
        goNext();
      });
    });});
  }
  function redraw(keepNote){
    var w=document.getElementById('calWrap'); if(w){w.innerHTML=calendarHtml();bindCal();}
    if(!keepNote){var n=document.getElementById('slotNote');if(n)n.textContent='Du lundi au samedi · arrivées de 09:00 à 19:00';}
  }
  bindCal();
};

/* ================= 6 · HEURE (nettoyage) ================= */
R.heure=function(){
  var h='<h2 class="wz-q">À quelle heure ?</h2><div class="wz-chips" id="heureChips">';
  if(!slotState.all.length) h+='<span class="wz-note">Recherche des disponibilités…</span>';
  slotState.all.forEach(function(t){
    var free=slotState.free.indexOf(t)>-1;
    h+='<button type="button" class="wz-chip'+(state.heure===t?' sel':'')+(free?'':' taken')+'" data-t="'+t+'"'+(free?'':' disabled')+'>'+t+'</button>';
  });
  return h+'</div><p class="wz-note">Un rendez-vous mobilise l\'atelier au moins 3 heures : les horaires barrés sont déjà pris.</p>';
};
B.heure=function(){
  if(slotState.date!==state.jourISO||slotState.svc!==serviceId()||!slotState.all.length){
    fetchSlots(function(){render();}); return;
  }
  panel.querySelectorAll('[data-t]').forEach(function(b){b.addEventListener('click',function(){
    if(b.disabled)return; state.heure=b.dataset.t;
    pushEvt({event:'slot_selected', slot_time:state.heure, slot_date:state.jourISO});
    goNext();
  });});
};

/* ================= DÉTAILS (devis) ================= */
R.details=function(){
  var others=SVC.filter(function(s){return s.k!=='nettoyage'&&s.k!=='autre'&&s.k!==state.svc;}).concat(AUTRE.filter(function(s){return s.k!==state.svc&&s.k!=='autre';}));
  var h='<h2 class="wz-q">Quelques précisions</h2>'+
    '<div class="field"><label id="etatLbl">Votre véhicule est…</label><div class="wz-pills" role="radiogroup" aria-labelledby="etatLbl">'+
    [['neuf','Neuf'],['occasion','D\'occasion']].map(function(x){return '<button type="button" class="wz-pill'+(state.etat===x[0]?' sel':'')+'" data-etat="'+x[0]+'" role="radio" aria-checked="'+(state.etat===x[0])+'">'+x[1]+'</button>';}).join('')+'</div></div>'+
    '<div class="field"><label for="msg">Un détail à nous préciser ? (facultatif)</label><textarea id="msg" rows="3" placeholder="Couleur, état de la peinture, finition souhaitée, délai…">'+esc(state.msg)+'</textarea></div>'+
    '<div class="field"><label>Aussi intéressé par ? (facultatif)</label><div class="wz-pills">'+
    others.map(function(s){return '<button type="button" class="wz-pill'+(state.more.indexOf(s.k)>-1?' sel':'')+'" data-more="'+s.k+'" aria-pressed="'+(state.more.indexOf(s.k)>-1)+'">'+s.label+'</button>';}).join('')+'</div></div>'+
    '<div class="field"><label class="photo-drop wz-photo" id="photoDrop"><input type="file" id="photoInput" accept="image/*" multiple style="display:none"><span>＋ Ajouter des photos du véhicule (facultatif, 3 max)</span></label><div class="photo-list" id="photoList"></div></div>'+
    '<div class="wz-after"><button type="button" class="btn solid wz-cta" id="wzGo">Continuer</button></div>';
  return h;
};
function renderPhotoList(){
  var list=document.getElementById('photoList'); if(!list) return;
  list.innerHTML=state.photos.map(function(f,i){return '<div class="photo-chip"><span>'+esc(f.name)+'</span><button type="button" data-rmphoto="'+i+'" aria-label="Retirer la photo">✕</button></div>';}).join('');
  list.querySelectorAll('[data-rmphoto]').forEach(function(b){b.addEventListener('click',function(){state.photos.splice(+b.dataset.rmphoto,1);renderPhotoList();});});
}
B.details=function(){
  bindInputs();
  panel.querySelectorAll('[data-etat]').forEach(function(b){b.addEventListener('click',function(){
    state.etat=(state.etat===b.dataset.etat)?'':b.dataset.etat;
    panel.querySelectorAll('[data-etat]').forEach(function(x){var on=x.dataset.etat===state.etat;x.classList.toggle('sel',on);x.setAttribute('aria-checked',on);});
  });});
  panel.querySelectorAll('[data-more]').forEach(function(b){b.addEventListener('click',function(){
    var k=b.dataset.more,i=state.more.indexOf(k); if(i>-1)state.more.splice(i,1);else state.more.push(k);
    b.classList.toggle('sel',i===-1);b.setAttribute('aria-pressed',i===-1);
  });});
  var pi=document.getElementById('photoInput');
  if(pi)pi.addEventListener('change',function(){
    [].slice.call(pi.files).forEach(function(f){
      if(state.photos.length>=3)return;
      if(f.size>6*1024*1024){showError('Photo trop lourde (6 Mo max) : '+f.name);return;}
      state.photos.push(f);
    });
    pi.value='';renderPhotoList();
  });
  renderPhotoList();
  document.getElementById('wzGo').addEventListener('click',goNext);
};

/* ================= COORDONNÉES + CONFIRMATION ================= */
R.coord=function(){
  var nett=flowType()==='prestation', f=chosenForm();
  var h='<h2 class="wz-q">'+(nett?'Dernière étape':'Vos coordonnées')+'</h2>';
  h+=contactFields();
  if(nett){
    var st=subTotal(), gt=grandTotal();
    h+='<div class="wz-recap" style="margin:14px 0 0"><div class="wz-total"><span>Total</span><b>'+((state.promo&&promoEligible())?'<s>'+st+' €</s> ':'')+gt+' € TTC</b></div>'+
       (optsTotal()>0?'<div><span>dont options</span><b>'+optsTotal()+' €</b></div>':'')+'</div>';
  }

  if(nett){
    h+='<details class="wz-fold"'+(state.optsOpen?' open':'')+' id="optFold"><summary>Ajouter une option (facultatif)'+(state.opts.length?' · '+state.opts.length:'')+'</summary><div class="optgrid" style="margin-top:10px">';
    var showVar=false;
    visibleOptions().forEach(function(op){
      var on=state.opts.indexOf(op.id)>-1; if(on&&op.variable)showVar=true;
      h+='<button type="button" class="optcard'+(on?' sel':'')+'" data-opt="'+op.id+'" aria-pressed="'+on+'"><span class="optck">'+(on?'✓':'+')+'</span><span class="optbody"><b>'+op.nom+'</b><span class="optd">'+op.desc+'</span></span><span class="optp"><i>à partir de</i>'+op.prix+'&nbsp;€</span></button>';
    });
    h+='</div>'+(showVar?'<p class="optnote">'+OPTS_VARIABLE_NOTE+'</p>':'')+'</details>';
    if(PROMO.active&&!(state.promo&&promoEligible())){
      h+='<details class="wz-fold"'+(state.promoOpen?' open':'')+' id="promoFold"><summary>J\'ai un code promo</summary><div class="promo-field" style="margin-top:10px"><input id="promoInput" placeholder="Code promo"><button type="button" id="promoBtn">Appliquer</button></div><p class="promo-hint" id="promoHint">Code −10 % valable sur les formules Premium et Expérience.</p></details>';
    } else if(state.promo&&promoEligible()){
      h+='<div class="promo-ok">✓ Code '+PROMO.code+' appliqué — <span class="x">−10 %</span></div>';
    }
    h+='<p class="wz-note">Votre créneau est confirmé immédiatement ; le règlement se fait sur place selon l\'état réel du véhicule.</p>';
  } else {
    h+='<p class="wz-note">Nous revenons vers vous sous 24 h avec une proposition chiffrée.</p>';
  }
  h+='<div class="wz-after"><button type="button" class="btn solid wz-cta" id="wzGo">'+(nett?(STRIPE_ENABLED?'Payer l\'acompte et confirmer':'Confirmer le rendez-vous'):'Envoyer ma demande')+'</button></div>';
  return h;
};
B.coord=function(){
  bindInputs();
  var of=document.getElementById('optFold'); if(of)of.addEventListener('toggle',function(){state.optsOpen=of.open;});
  var pf=document.getElementById('promoFold'); if(pf)pf.addEventListener('toggle',function(){state.promoOpen=pf.open;});
  panel.querySelectorAll('[data-opt]').forEach(function(b){b.addEventListener('click',function(){
    var id=b.dataset.opt,k=state.opts.indexOf(id); if(k>-1)state.opts.splice(k,1);else state.opts.push(id);
    state.optsOpen=true;pushEvt({event:'option_toggled', option:id, selected:k===-1});render();
  });});
  var pb=document.getElementById('promoBtn');
  if(pb)pb.addEventListener('click',function(){
    var v=(document.getElementById('promoInput').value||'').trim().toUpperCase(), hint=document.getElementById('promoHint');
    if(v!==PROMO.code){if(hint){hint.textContent='Code invalide.';hint.style.color='#fff';}return;}
    if(!promoEligible()){if(hint){hint.textContent='Ce code est valable sur Premium et Expérience. Choisissez l\'une de ces formules pour en profiter.';hint.style.color='#fff';}return;}
    state.promo=true;render();
  });
  document.getElementById('wzGo').addEventListener('click',function(){if(!validContact())return;done();});
};

/* ================= ENVOI ================= */
function optsNotes(){
  var vis=visibleOptions();
  var chosen=state.opts.map(function(id){return vis.find(function(o){return o.id===id});}).filter(Boolean);
  return chosen.length?('Options : '+chosen.map(function(o){return o.nom;}).join(', ')):undefined;
}
function done(){
  var btn=document.getElementById('wzGo');
  if(flowType()==='prestation'){
    if(btn){btn.disabled=true;btn.textContent=STRIPE_ENABLED?'Redirection vers le paiement…':'Confirmation…';}
    var f=chosenForm(), notesParts=[optsNotes(),utmNoteLine()].filter(Boolean);
    var payload={service:serviceId(),vehicleType:state.gab,vehicleModel:vehLabel(),date:state.jourISO,time:state.heure,
      client:{firstName:state.prenom.trim(),lastName:state.nomFam.trim(),phone:state.tel,email:state.email,notes:notesParts.length?notesParts.join(' — '):undefined},
      opts:state.opts};
    var url='/api/create-booking';
    if(STRIPE_ENABLED){url='/api/create-checkout-session';payload.paymentType='deposit';}
    var label=STRIPE_ENABLED?'Payer l\'acompte et confirmer':'Confirmer le rendez-vous';
    fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      .then(function(r){return r.json();})
      .then(function(data){
        if(data.error){showError(data.error,label);return;}
        if(data.url){window.location.href=data.url;return;}
        if(data.sessionId){
          /* booking_complete : uniquement après confirmation réelle du serveur. */
          pushEvt({event:'booking_complete',service:serviceId(),formula:f.k,service_area:state.clean,clean_type:state.clean,
                   vehicle_type:state.gab,vehicle_label:vehLabel()||null,journey:'direct',value:grandTotal(),currency:'EUR'});
          var qs='session_id='+encodeURIComponent(data.sessionId),utm=utmQueryString(); if(utm)qs+='&'+utm;
          setTimeout(function(){window.location.href='/confirmation.html?'+qs;},250);
        }
      })
      .catch(function(){showError('Erreur de connexion. Vérifiez votre réseau et réessayez.',label);});
    return;
  }
  if(btn){btn.disabled=true;btn.textContent='Envoi…';}
  var sel=[state.svc].concat(state.more), labels=sel.map(svcLabel);
  var parts=['Prestations souhaitées : '+labels.join(', ')];
  if(state.etat) parts.push('Véhicule '+(state.etat==='neuf'?'neuf':'d\'occasion'));
  if((state.msg||'').trim()) parts.push(state.msg.trim());
  var source='Rendez-vous en ligne (rendez-vous.html) | prestations='+sel.join(',');
  var utm=utmNoteLine(); if(utm) source+=' | '+utm.replace(/^Source : /,'');
  var subject='Demande de devis — '+labels.join(', ');
  var fn=state.prenom.trim(), ln=state.nomFam.trim(), vehicleInfo=vehLabel();
  var onDone=function(good){
    if(!good){showError('L\'envoi a échoué. Réessayez dans un instant, ou appelez-nous au 07 63 00 43 85.','Envoyer ma demande');return;}
    pushEvt({event:'project_request_sent',projects:sel});
    var main=sel.filter(function(k){return k==='ppf'||k==='ceramique'||k==='polissage';});
    pushEvt({event:'generate_lead',service:main.length===1?main[0]:'rendez-vous',form_location:'rendez_vous',currency:'EUR',value:0,
             lead_source:'rendez-vous.html',link_location:'form',page_type:'rendez_vous',cible:'general',formule:sel.join(',')});
    var target='merci-devis.html?service='+encodeURIComponent(main.length===1?main[0]:'rendez-vous');
    setTimeout(function(){window.location.href=target;},250);
  };
  if(state.photos.length){
    var fd=new FormData();
    fd.append('firstName',fn);fd.append('lastName',ln);fd.append('email',state.email);fd.append('phone',state.tel);
    fd.append('subject',subject);fd.append('vehicleInfo',vehicleInfo);fd.append('message',parts.join('\n'));fd.append('source',source);
    state.photos.forEach(function(p){fd.append('photos',p);});
    fetch('/api/devis-photos',{method:'POST',body:fd}).then(function(r){onDone(!!(r&&r.ok));}).catch(function(){onDone(false);});
  } else {
    fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type:'devis',firstName:fn,lastName:ln,email:state.email,phone:state.tel,subject:subject,vehicleInfo:vehicleInfo,message:parts.join('\n'),source:source})})
      .then(function(r){onDone(!!(r&&r.ok));}).catch(function(){onDone(false);});
  }
}

/* ---------- retour, téléphone ---------- */
if(elBack)elBack.addEventListener('click',goPrev);
document.addEventListener('click',function(e){
  var a=e.target.closest('a[href^="tel:"]');
  if(a) pushEvt({event:'click_phone', booking_type:flowType()});
},true);

/* ============================================================
   LIENS D'ARRIVÉE (annonces Google Ads, pages du site)
   ?service=interieur|exterieur|complet|confort|premium|experience → nettoyage pré-orienté
   ?projet=ppf|ceramique|polissage|covering|vitres-teintees|jantes|car-staging → prestation choisie
   Les étapes déjà déterminées sont sautées ; tout reste modifiable via « retour ».
   ============================================================ */
(function(){
  var sp=new URLSearchParams(location.search), want=(sp.get('service')||'').toLowerCase(), proj=(sp.get('projet')||'').toLowerCase();
  if(want){
    var areas={interieur:'interieur',exterieur:'exterieur',complet:'duo',duo:'duo'}, tiers={confort:0,premium:1,experience:2,'expérience':2};
    var hit=false;
    if(Object.prototype.hasOwnProperty.call(areas,want)){state.clean=areas[want];state.skip.zone=true;hit=true;}
    if(Object.prototype.hasOwnProperty.call(tiers,want)){state.form=tiers[want];state.skip.form=true;hit=true;}
    if(hit){state.svc='nettoyage';state.skip.svc=true;
    }
  }
  if(proj){
    var map={'car-staging':'staging','staging':'staging','ceramique':'ceramique','ppf':'ppf','vitres-teintees':'vitres','vitres':'vitres','wrap':'covering','covering':'covering','polissage':'polissage','jantes':'jantes','renovation-jantes':'jantes'};
    if(proj==='nettoyage'){state.svc='nettoyage';state.skip.svc=true;}
    else if(Object.prototype.hasOwnProperty.call(map,proj)){state.svc=map[proj];state.skip.svc=true;}
  }
  render();
})();

})();
