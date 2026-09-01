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
   GABARITS & SUPPLÉMENTS
   Le prix affiché = prix de base de la formule (tarif Citadine)
   + le supplément du gabarit ci-dessous. Citadine = référence.
   ============================================================ */
var GABARITS={
  citadine:{label:'Citadine', desc:'Petite voiture urbaine', supp:0},
  berline:{label:'Berline / Break', desc:'Compacte, berline, break', supp:20},
  suv:{label:'SUV / 4×4', desc:'SUV, crossover, tout-terrain', supp:40},
  van:{label:'Utilitaire / Van', desc:'Monospace 7+ places, utilitaire', supp:70},
  sportive:{label:'Sportive / Exception', desc:'Sportive, GT, supercar', supp:60}
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
    {k:'Confort', nom:'Confort', prix:69,
      pitch:'Idéale pour l\'entretien régulier d\'un véhicule déjà correctement entretenu.',
      highlights:['Aspiration en surface de l\'habitacle et des tapis','Dépoussiérage des plastiques et surfaces intérieures','Nettoyage des vitres intérieures'],
      detail:['Aspiration en surface de l\'habitacle','Aspiration des tapis','Dépoussiérage des plastiques et surfaces intérieures','Nettoyage léger des surfaces accessibles','Nettoyage des vitres intérieures'],
      outro:'Une prestation essentielle pour conserver votre véhicule propre au quotidien.'},
    {k:'Premium', nom:'Premium', prix:129, reco:true,
      pitch:'Un nettoyage intérieur approfondi pour retrouver un habitacle parfaitement propre.',
      highlights:['Aspiration approfondie de l\'habitacle, tapis et moquettes','Shampooing des sièges tissu ou dégraissage des sièges cuir','Nettoyage approfondi des plastiques et de la console','Parfum intérieur REYCE'],
      detail:['Aspiration approfondie de l\'habitacle','Aspiration des moquettes','Aspiration et nettoyage des tapis','Shampooing des sièges en tissu, ou nettoyage et dégraissage des sièges en cuir selon le véhicule','Nettoyage approfondi des plastiques','Nettoyage de la console centrale','Nettoyage des surfaces intérieures','Nettoyage des entrants de portes','Nettoyage des vitres intérieures','Désodorisation de l\'habitacle','Parfum intérieur REYCE'],
      outro:'Idéale pour une remise au propre approfondie de l\'intérieur.'},
    {k:'Expérience', nom:'Expérience', prix:229, top:true, deep:true,
      pitch:'L\'Expérience REYCE va au-delà du nettoyage traditionnel : chaque zone de l\'habitacle est travaillée en profondeur.',
      highlights:['Aspiration complète, y compris sous les sièges et zones difficiles d\'accès','Shampooing en profondeur des sièges, moquettes et tapis','Cuirs dégraissés, nettoyés, nourris et protégés','Traitement à l\'ozone — neutralise durablement les mauvaises odeurs'],
      detail:['Aspiration complète et en profondeur','Aspiration sous les sièges et dans les zones difficiles d\'accès','Shampooing en profondeur des sièges en tissu','Shampooing des moquettes','Nettoyage et shampooing en profondeur des tapis','Nettoyage des rails et contours de sièges','Nettoyage des ceintures de sécurité','Nettoyage du plafonnier','Nettoyage approfondi des plastiques','Nettoyage de la console centrale','Nettoyage des aérateurs, boutons et commandes','Nettoyage approfondi des entrants et seuils de portes','Nettoyage des vitres et miroirs intérieurs','Pour les intérieurs cuir : dégraissage, nettoyage approfondi, nourrissage et protection','Finition et protection des plastiques intérieurs','Désodorisation complète et traitement à l\'ozone','Parfum intérieur et finition REYCE']}
  ]},
  exterieur:{label:'Extérieur', svc:'ext', formules:[
    {k:'Confort', nom:'Confort', prix:49,
      pitch:'Idéale pour l\'entretien régulier d\'un véhicule déjà correctement entretenu.',
      highlights:['Prélavage au canon à mousse','Shampooing extérieur et rinçage complet','Nettoyage des jantes en surface et séchage soigné'],
      detail:['Prélavage au canon à mousse','Shampooing extérieur','Rinçage complet','Nettoyage des jantes en surface','Nettoyage des vitres extérieures','Séchage soigné'],
      outro:'Une prestation essentielle pour conserver votre véhicule propre au quotidien.'},
    {k:'Premium', nom:'Premium', prix:89, reco:true,
      pitch:'Un lavage extérieur approfondi pour une carrosserie parfaitement propre.',
      highlights:['Lavage manuel au gant et shampooing extérieur','Nettoyage complet des jantes et des pneus','Shampooing lustrant — une finition qui apporte de la brillance'],
      detail:['Prélavage au canon à mousse','Lavage manuel au gant','Shampooing extérieur','Nettoyage complet des jantes','Nettoyage des pneus','Finition et dressing pneus','Shampooing lustrant — une finition rapide qui apporte davantage de brillance à la carrosserie','Nettoyage des vitres extérieures','Séchage soigné'],
      outro:'Idéale pour une remise au propre approfondie de l\'extérieur.'},
    {k:'Expérience', nom:'Expérience', prix:149, top:true, deep:true,
      pitch:'L\'Expérience REYCE va au-delà du nettoyage traditionnel : chaque zone de la carrosserie est travaillée en profondeur.',
      highlights:['Lavage manuel minutieux et jantes travaillées en profondeur','Passages de roues, garde-boues et recoins difficiles d\'accès traités','Dressing premium pneus, plastiques et passages de roues','Cire premium appliquée à la main, effet hydrophobe'],
      detail:['Prélavage complet au canon à mousse','Lavage manuel minutieux au gant','Shampooing extérieur premium','Nettoyage en profondeur des jantes et des pneus','Nettoyage des passages de roues et des garde-boues','Nettoyage des recoins et zones difficiles d\'accès','Nettoyage des contours, joints et détails extérieurs','Nettoyage complet des vitres','Dressing premium des pneus, plastiques extérieurs et passages de roues','Finitions détaillées de la carrosserie','Protection carrosserie : application à la main d\'une cire premium','Brillance et profondeur renforcées, effet hydrophobe pouvant durer environ 6 à 12 mois selon l\'usage, l\'entretien du véhicule et les conditions extérieures']}
  ]},
  duo:{label:'Intérieur + Extérieur', svc:'duo', formules:[
    {k:'Confort', nom:'Confort', prix:99,
      pitch:'Idéale pour l\'entretien régulier d\'un véhicule déjà correctement entretenu.',
      highlights:['Aspiration en surface de l\'habitacle et des tapis','Prélavage au canon à mousse et shampooing extérieur','Nettoyage des vitres, intérieur et extérieur'],
      detailInt:['Aspiration en surface de l\'habitacle','Aspiration des tapis','Dépoussiérage des plastiques et surfaces intérieures','Nettoyage léger des surfaces accessibles','Nettoyage des vitres intérieures'],
      detailExt:['Prélavage au canon à mousse','Shampooing extérieur','Rinçage complet','Nettoyage des jantes en surface','Nettoyage des vitres extérieures','Séchage soigné'],
      outro:'Une prestation essentielle pour conserver votre véhicule propre au quotidien.'},
    {k:'Premium', nom:'Premium', prix:169, reco:true,
      pitch:'Un nettoyage intérieur et extérieur approfondi pour retrouver un véhicule parfaitement propre.',
      highlights:['Aspiration approfondie de l\'habitacle, tapis et moquettes','Shampooing sièges tissu ou dégraissage cuir','Lavage manuel au gant, jantes et pneus nettoyés en profondeur','Shampooing lustrant apportant davantage de brillance','Parfum intérieur REYCE'],
      detailInt:['Aspiration approfondie de l\'habitacle','Aspiration des moquettes','Aspiration et nettoyage des tapis','Shampooing des sièges en tissu, ou nettoyage et dégraissage des sièges en cuir selon le véhicule','Nettoyage approfondi des plastiques','Nettoyage de la console centrale','Nettoyage des surfaces intérieures','Nettoyage des entrants de portes','Nettoyage des vitres intérieures','Désodorisation de l\'habitacle','Parfum intérieur REYCE'],
      detailExt:['Prélavage au canon à mousse','Lavage manuel au gant','Shampooing extérieur','Nettoyage complet des jantes','Nettoyage des pneus','Finition et dressing pneus','Shampooing lustrant — une finition rapide qui apporte davantage de brillance à la carrosserie','Nettoyage des vitres extérieures','Séchage soigné'],
      outro:'Idéale pour une remise au propre approfondie de l\'intérieur comme de l\'extérieur.'},
    {k:'Expérience', nom:'Expérience', prix:299, top:true, deep:true,
      pitch:'L\'Expérience REYCE va au-delà du nettoyage traditionnel. Chaque partie du véhicule est travaillée en profondeur afin de retrouver un niveau de propreté, de finition et de protection exceptionnel.',
      highlights:['Detailing complet de l\'habitacle, jusque dans les moindres recoins','Cuirs dégraissés, nettoyés, nourris et protégés','Traitement à l\'ozone — neutralise durablement les mauvaises odeurs','Lavage manuel minutieux et jantes travaillées en profondeur','Cire premium appliquée à la main, effet hydrophobe'],
      detailInt:['Aspiration complète et en profondeur','Aspiration sous les sièges et dans les zones difficiles d\'accès','Shampooing en profondeur des sièges en tissu','Shampooing des moquettes','Nettoyage et shampooing en profondeur des tapis','Nettoyage des rails et contours de sièges','Nettoyage des ceintures de sécurité','Nettoyage du plafonnier','Nettoyage approfondi des plastiques','Nettoyage de la console centrale','Nettoyage des aérateurs, boutons et commandes','Nettoyage approfondi des entrants et seuils de portes','Nettoyage des vitres et miroirs intérieurs','Pour les intérieurs cuir : dégraissage, nettoyage approfondi, nourrissage et protection','Finition et protection des plastiques intérieurs','Désodorisation complète et traitement à l\'ozone','Parfum intérieur et finition REYCE'],
      detailExt:['Prélavage complet au canon à mousse','Lavage manuel minutieux au gant','Shampooing extérieur premium','Nettoyage en profondeur des jantes et des pneus','Nettoyage des passages de roues et des garde-boues','Nettoyage des recoins et zones difficiles d\'accès','Nettoyage des contours, joints et détails extérieurs','Nettoyage complet des vitres','Dressing premium des pneus, plastiques extérieurs et passages de roues','Finitions détaillées de la carrosserie','Protection carrosserie : application à la main d\'une cire premium','Brillance et profondeur renforcées, effet hydrophobe pouvant durer environ 6 à 12 mois selon l\'usage, l\'entretien du véhicule et les conditions extérieures'],
      outro:'La formule pensée pour une véritable remise à neuf, ou pour le niveau de finition le plus complet proposé par REYCE.'}
  ]}
};

/* ============================================================
   OPTIONS / SUPPLÉMENTS AU CHOIX
   prix:0 -> s'affiche "___" tant que le tarif n'est pas défini.
   ============================================================ */
var OPTIONS=[
  {id:'poils', nom:'Poils d\'animaux', desc:'Traitement spécifique sièges & moquettes', prix:0},
  {id:'taches', nom:'Taches incrustées', desc:'Détachage en profondeur des salissures tenaces', prix:0},
  {id:'ozone', nom:'Désinfection ozone', desc:'Élimine odeurs (tabac, animaux) et bactéries', prix:0},
  {id:'cuir', nom:'Rénovation cuir', desc:'Nettoyage, nourrissage et protection des cuirs', prix:0},
  {id:'phares', nom:'Rénovation optiques', desc:'Polissage des phares ternis ou jaunis', prix:0},
  {id:'hydro', nom:'Protection hydrophobe vitres', desc:'Effet déperlant longue durée sur les vitrages', prix:0}
];

/* Code promo — réservé aux formules Premium & Expérience */
var PROMO={active:true, code:'BIENVENUE10', rate:0.10, until:'31 août 2026', formules:['Premium','Expérience']};

function euro(n){return n>0?(n+'<span class="eur">€</span>'):'___<span class="eur">€</span>';}
function euroTxt(n){return n>0?(n+' €'):'___ €';}
function duoSave(idx){
  var s=gabSupp();
  var i=CLEAN.interieur.formules[idx].prix, e=CLEAN.exterieur.formules[idx].prix, d=CLEAN.duo.formules[idx].prix;
  if(i>0&&e>0&&d>0) return {sep:i+e+2*s, duo:d+s, save:(i+e-d+s)};
  return null;
}

var times=['09:00','10:30','13:00','14:30','16:00','17:30'];
var projets=[
  {label:'PPF (protection peinture)', img:'assets/img/30644946.jpg'},
  {label:'Covering / Wrap', img:'assets/img/8664307.jpg'},
  {label:'Vitres teintées', img:'assets/img/22737744.jpg'},
  {label:'Customisation', img:'assets/img/32726106.jpg'},
  {label:'Ligne d\'échappement', img:'assets/img/6872609.jpg'},
  {label:'Autre projet', img:'assets/img/20042048.jpg'}
];
var contactModes=['Par téléphone','En visio','À l\'atelier'];
var LAB={
  prestation:['Véhicule','Nettoyage','Formule','Créneau','Coordonnées'],
  projet:['Projet','Véhicule','Échange','Coordonnées']
};

var today=new Date();
var state={type:'prestation',clean:'duo',form:1,marque:'',modele:'',gab:null,gabAuto:false,manualGab:false,opts:[],promo:false,
           calYear:today.getFullYear(),calMonth:today.getMonth(),jourISO:null,jourLabel:null,heure:null,
           projet:[],photos:[],mode:null,nom:'',tel:'',email:'',msg:''};
var step=0;
var MONTHS_FR=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

document.querySelectorAll('#rtype button').forEach(function(b){b.addEventListener('click',function(){
  document.querySelectorAll('#rtype button').forEach(function(x){x.classList.remove('sel');});b.classList.add('sel');
  state.type=b.dataset.type;step=0;render();})});

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

/* prix courant sélectionné (avant promo) */
function gabSupp(){return (state.gab&&GABARITS[state.gab])?GABARITS[state.gab].supp:0;}
function optsTotal(){var t=0;state.opts.forEach(function(id){var o=OPTIONS.find(function(x){return x.id===id});if(o)t+=o.prix;});return t;}
function promoEligible(){return PROMO.active && PROMO.formules.indexOf(CLEAN[state.clean].formules[state.form].k)>-1;}
function subTotal(){var bp=basePrice();if(bp<=0)return 0;return bp+optsTotal();}
function grandTotal(){var st=subTotal();if(st<=0)return 0;return (state.promo&&promoEligible())?Math.round(st*(1-PROMO.rate)):st;}
function basePrice(){if(state.type!=='prestation')return 0;var f=CLEAN[state.clean].formules[state.form];if(!f||f.prix<=0)return 0;return f.prix+gabSupp();}
function serviceId(){
  var f=CLEAN[state.clean].formules[state.form];
  var key=f.k==='Confort'?'confort':(f.k==='Premium'?'premium':'experience');
  return 'nettoyage-'+CLEAN[state.clean].svc+'-'+key;
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

var ASIDE_TXT={
  prestation:['Trois formules : Confort, Premium, Expérience. Choisissez le niveau de soin, puis votre créneau.',
    'Encore quatre étapes, deux minutes.','Plus que le créneau et vos coordonnées.',
    'Presque fini — choisissez votre heure.','Dernière ligne droite avant confirmation.'],
  projet:['Décrivez votre projet, on vous recontacte pour chiffrer ensemble.',
    'Encore trois étapes.','On y est presque.','Dernière étape avant l\'envoi.']
};

function updateProgress(){
  var fill=document.getElementById('wizProgressFill');
  if(!fill) return;
  var L=LAB[state.type];
  fill.style.width=(((step+1)/L.length)*100)+'%';
}

function updateAsideSummary(){
  var el=document.getElementById('wizSummary');
  if(!el) return;
  if(step<1){el.innerHTML='';el.style.display='none';return;}

  if(state.type==='prestation'){
    var f=CLEAN[state.clean].formules[state.form];
    var rows='';
    if(state.marque||state.modele||state.gab){
      var vehLabel=(state.marque+' '+state.modele).trim()||(state.gab?GABARITS[state.gab].label:'');
      if(vehLabel) rows+='<div class="ws-row"><span>Véhicule</span><b>'+vehLabel+'</b></div>';
    }
    rows+='<div class="ws-row"><span>Nettoyage</span><b>'+CLEAN[state.clean].label+'</b></div>';
    if(step>=2){rows+='<div class="ws-row"><span>Formule</span><b>'+f.k+'</b></div>';}
    if(state.jourLabel&&state.heure){rows+='<div class="ws-row"><span>Créneau</span><b>'+state.jourLabel+' · '+state.heure+'</b></div>';}
    if(step>=2){var gt=grandTotal();
      rows+='<div class="ws-row ws-total"><span>Total estimé</span><b>'+(gt>0?(gt+' €'):(f.prix>0?((f.prix+gabSupp())+' €'):'sur devis'))+'</b></div>';}
    el.innerHTML=rows;
    el.style.display='block';
    return;
  }

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
    if(step===0){
      h+=head+'<h4>Votre véhicule.</h4>';
      h+='<div class="vehsearch">'+
         '<div class="row2">'+
           '<div class="field"><label>Marque</label><input id="marque" autocomplete="off" placeholder="Renault, BMW, Tesla…" value="'+state.marque+'"><div class="ac" id="acMk"></div></div>'+
           '<div class="field"><label>Modèle</label><input id="modele" autocomplete="off" placeholder="Clio, Série 3, Model 3…" value="'+state.modele+'"><div class="ac" id="ac"></div></div>'+
         '</div></div>';
      var g=state.gab;
      h+='<div class="gabbox" id="gabbox">';
      if(g&&state.gabAuto){
        h+='<div class="gab-auto"><span class="gk">Gabarit détecté</span><span class="gv">'+GABARITS[g].label+'</span><button type="button" class="gchange" id="gchange">Modifier</button></div>';
      } else if(state.manualGab){
        h+='<div class="gab-manual"><span class="gk">Choisissez votre gabarit :</span><div class="gabs">';
        for(var gk in GABARITS){h+='<button type="button" class="gabo'+(state.gab===gk?' sel':'')+'" data-gab="'+gk+'"><b>'+GABARITS[gk].label+'</b><span>'+GABARITS[gk].desc+'</span></button>';}
        h+='</div></div>';
      } else {
        h+='<p style="color:var(--dim-2);font-size:.82rem;margin-top:4px">Tapez votre marque et modèle ci-dessus, le gabarit se détecte automatiquement.</p>'+
           '<label style="display:flex;align-items:center;gap:10px;margin-top:14px;cursor:pointer;font-size:.85rem;color:var(--dim)"><input type="checkbox" id="noModel" style="width:16px;height:16px;accent-color:#fff"> Je ne trouve pas mon modèle</label>';
      }
      h+='</div>';
    }
    else if(step===1){
      h+=head+'<h4>Quel nettoyage pour votre '+(state.gab?GABARITS[state.gab].label:'véhicule')+' ?</h4>';
      h+='<div class="clean3" id="clean3">';
      [['interieur','Formule A','Habitacle comme neuf : sièges, plastiques, vitres, cuirs.'],
       ['exterieur','Formule B','Carrosserie, jantes, brillance et protection.'],
       ['duo','Formule C','Le véhicule entièrement repris, dedans comme dehors.']].forEach(function(row){
        var key=row[0], best=(key==='duo');
        var sv=best?duoSave(state.form):null;
        var saveHtml='';
        if(best){ saveHtml = sv ? ('<div class="save"><s>'+sv.sep+' €</s>'+sv.duo+' € · vous économisez '+sv.save+' €</div>')
                                 : '<div class="save">Le prix des deux, avantageux</div>'; }
        h+='<button type="button" data-clean="'+key+'" class="'+(state.clean===key?'sel ':'')+(best?'best':'')+'">'+
           (best?'<span class="flag">Le plus complet</span>':'')+
           '<span class="ck">'+row[1]+'</span>'+
           '<div><h3>'+CLEAN[key].label+'</h3><p>'+row[2]+'</p></div>'+
           saveHtml+'</button>';
      });
      h+='</div>';
      h+='<p style="color:var(--dim-2);margin-top:16px;font-size:.82rem;max-width:52ch">La formule complète est notre soin le plus demandé : le véhicule repris intégralement, dedans comme dehors.</p>';
    }
    else if(step===2){
      var fs=CLEAN[state.clean].formules;
      h+=head+'<h4>Choisissez votre formule — '+CLEAN[state.clean].label+'</h4>';
      h+='<div class="forms">';
      fs.forEach(function(f,i){
        var cls='formcard'+(state.form===i?' sel':'')+(f.reco?' reco':'')+(f.top?' top':'');
        var tag=f.top?'<span class="tag alt">Signature REYCE</span>':(f.reco?'<span class="tag">Recommandé</span>':'');
        var hi='<ul>'+f.highlights.map(function(x){return '<li><span class="tk">—</span>'+x+'</li>'}).join('')+'</ul>';
        var detailHtml='';
        if(f.detailInt&&f.detailExt){
          detailHtml='<details class="fdetail"><summary><span>Voir le détail complet</span><span class="pm"></span></summary>'+
            '<div class="fdetail-group"><h5>Intérieur</h5><ul>'+f.detailInt.map(function(x){return '<li><span class="tk">—</span>'+x+'</li>'}).join('')+'</ul></div>'+
            '<div class="fdetail-group"><h5>Extérieur</h5><ul>'+f.detailExt.map(function(x){return '<li><span class="tk">—</span>'+x+'</li>'}).join('')+'</ul></div>'+
            '</details>';
        } else if(f.detail){
          detailHtml='<details class="fdetail"><summary><span>Voir le détail complet</span><span class="pm"></span></summary>'+
            '<ul>'+f.detail.map(function(x){return '<li><span class="tk">—</span>'+x+'</li>'}).join('')+'</ul></details>';
        }
        h+='<div class="'+cls+'" data-form="'+i+'">'+tag+
           '<div><div class="fk">'+f.k+'</div><h4>'+f.nom+'</h4><div class="fsub">'+TIER_SUB[f.k]+'</div></div>'+
           '<div class="price"><span class="from">À partir de</span>'+euro(f.prix>0?(f.prix+gabSupp()):0)+'</div>'+
           '<p class="fpitch">'+f.pitch+'</p>'+hi+detailHtml+
           (f.outro?'<p class="fnote">'+f.outro+'</p>':'')+
           '<div class="pick">'+(state.form===i?'Sélectionnée':(f.top?'Vivre l\'expérience':'Choisir'))+'</div></div>';
      });
      h+='</div>';
      h+='<div class="optsec"><div class="optsec-h"><h4 style="margin:0">Ajoutez des options</h4><span class="mono">Facultatif</span></div><div class="optgrid">';
      OPTIONS.forEach(function(op){
        var on=state.opts.indexOf(op.id)>-1;
        h+='<button type="button" class="optcard'+(on?' sel':'')+'" data-opt="'+op.id+'">'+
           '<span class="optck">'+(on?'✓':'+')+'</span>'+
           '<span class="optbody"><b>'+op.nom+'</b><span class="optd">'+op.desc+'</span></span>'+
           '<span class="optp">'+(op.prix>0?('+'+op.prix+' €'):'+___€')+'</span></button>';
      });
      h+='</div></div>';

      var sv=duoSave(state.form);
      if(state.clean==='duo'){
        h+='<div class="combo">';
        if(sv){h+='<div class="l"><span>Les deux soins séparément</span><s>'+sv.sep+' €</s></div>';}
        h+='<div class="tot"><span>Formule complète '+fs[state.form].k+'</span><span class="v">'+euroTxt(fs[state.form].prix>0?(fs[state.form].prix+gabSupp()):0)+'</span></div>';
        if(sv){h+='<div class="eco">Le complet vous fait économiser '+sv.save+' € — et va au bout des choses</div>';}
        else{h+='<div class="eco">Le soin le plus abouti, dedans comme dehors</div>';}
        h+='</div>';
      }
    }
    else if(step===3){
      h+=head+'<h4>Choisissez un jour.</h4><div id="calWrap">'+calendar()+'</div>'+
      '<div class="field" style="margin-top:24px"><label>Heure d\'arrivée</label><div class="chips" id="heureChips">';
      times.forEach(function(t){h+='<div class="chip'+(state.heure===t?' sel':'')+'" data-t="'+t+'">'+t+'</div>'});h+='</div></div>';
    }
    else if(step===4){
      var f=CLEAN[state.clean].formules[state.form];
      h+=head+'<h4>Presque terminé.</h4>'+
      '<div class="field"><label>Nom complet</label><input id="nom" placeholder="Votre nom" value="'+state.nom+'"></div>'+
      '<div class="row2"><div class="field"><label>Téléphone</label><input id="tel" placeholder="06 …" value="'+state.tel+'"></div>'+
      '<div class="field"><label>Email</label><input id="email" placeholder="vous@email.com" value="'+state.email+'"></div></div>';
      h+='<div class="recap">'+
        '<div class="rl"><span>Nettoyage</span><b>'+CLEAN[state.clean].label+'</b></div>'+
        '<div class="rl"><span>Formule</span><b>'+f.k+'</b></div>'+
        '<div class="rl"><span>Gabarit</span><b>'+(state.gab?GABARITS[state.gab].label:'—')+'</b></div>'+
        '<div class="rl"><span>Véhicule</span><b>'+((state.marque||'—')+' '+state.modele)+'</b></div>'+
        '<div class="rl"><span>Créneau</span><b>'+(state.jourLabel?(state.jourLabel+' · '+(state.heure||'—')):'—')+'</b></div>'+
        (state.opts.length?'<div class="rl"><span>Options</span><b>'+state.opts.map(function(id){var o=OPTIONS.find(function(x){return x.id===id});return o?o.nom:'';}).join(', ')+'</b></div>':'')+
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
    h+='<div class="pnav"><button type="button" class="btn ghost" id="back" '+(step===0?'style="visibility:hidden"':'')+'>← Retour</button>'+
       '<button type="button" class="btn" id="next">'+(step===last?lastLabel:'Continuer →')+'</button></div>';
    setPanel(h);bindP(last);animateAmt();return;
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
  setPanel(h);bindJ(lastJ);
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
    state={type:state.type,clean:'duo',form:1,marque:'',modele:'',gab:null,gabAuto:false,manualGab:false,opts:[],promo:false,
           calYear:today.getFullYear(),calMonth:today.getMonth(),jourISO:null,jourLabel:null,heure:null,
           projet:[],photos:[],mode:null,nom:'',tel:'',email:'',msg:''};lastAmt=null;render();});
}

function done(){
  if(state.type==='prestation'){
    var next=document.getElementById('next');
    var nm=splitName(state.nom);
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
          client: {firstName: nm.firstName, lastName: nm.lastName, phone: state.tel, email: state.email},
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
    fetch('/api/create-booking',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        service: serviceId(),
        vehicleType: state.gab,
        vehicleModel: (state.marque+' '+state.modele).trim(),
        date: state.jourISO,
        time: state.heure,
        client: {firstName: nm.firstName, lastName: nm.lastName, phone: state.tel, email: state.email}
      })
    }).then(function(r){return r.json();}).then(function(data){
      if(data.error){showError(data.error,'Confirmer le rendez-vous');return;}
      if(data.sessionId){window.location.href='/confirmation.html?session_id='+encodeURIComponent(data.sessionId);}
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
function bindCommon(){
  var back=document.getElementById('back');
  if(back)back.addEventListener('click',function(){if(step>0){step--;navDirection='back';render()}});
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
function validPrestationStep(){
  if(step===0){ if(!state.gab){flashEl('gabbox');return false;} return true; }
  if(step===3){
    if(!state.jourISO){flashEl('calWrap');return false;}
    if(!state.heure){flashEl('heureChips');return false;}
    return true;
  }
  if(step===4){
    if(!state.nom.trim()){flashEl('nom');return false;}
    if(!state.tel.trim()&&!state.email.trim()){flashEl('tel');flashEl('email');return false;}
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

function bindP(last){
  panel.querySelectorAll('[data-clean]').forEach(function(b){b.addEventListener('click',function(){state.clean=b.dataset.clean;render()})});
  panel.querySelectorAll('[data-form]').forEach(function(b){b.addEventListener('click',function(){state.form=+b.dataset.form;render()})});
  panel.querySelectorAll('.fdetail summary').forEach(function(s){s.addEventListener('click',function(e){e.stopPropagation();})});
  panel.querySelectorAll('[data-opt]').forEach(function(b){b.addEventListener('click',function(){var id=b.dataset.opt;var k=state.opts.indexOf(id);if(k>-1)state.opts.splice(k,1);else state.opts.push(id);render()})});
  var promoBtn=document.getElementById('promoBtn');
  if(promoBtn)promoBtn.addEventListener('click',function(){
    var v=(document.getElementById('promoInput').value||'').trim().toUpperCase();
    var hint=document.getElementById('promoHint');
    if(v!==PROMO.code){ if(hint){hint.textContent='Code invalide.';hint.style.color='#fff';} return; }
    if(!promoEligible()){ if(hint){hint.textContent='Ce code est valable sur Premium et Expérience. Choisissez l\'une de ces formules pour en profiter.';hint.style.color='#fff';} return; }
    state.promo=true; render();
  });
  panel.querySelectorAll('[data-t]').forEach(function(b){b.addEventListener('click',function(){state.heure=b.dataset.t;render()})});
  function bI(id,key){var el=document.getElementById(id);if(el)el.addEventListener('input',function(e){state[key]=e.target.value;})}
  bI('nom','nom');bI('tel','tel');bI('email','email');

  /* ---- étape véhicule : autocomplétion + détection gabarit ---- */
  var acBox=document.getElementById('ac');
  var acMk=document.getElementById('acMk');
  var inpM=document.getElementById('marque'), inpMod=document.getElementById('modele');
  var BRANDS=Object.keys(VDB);
  function suggestMk(){
    if(!acMk)return; var q=norm(state.marque);
    var res=BRANDS.filter(function(m){return !q||norm(m).indexOf(q)>-1;});
    if(!res.length){acMk.innerHTML='';acMk.classList.remove('on');return;}
    if(res.length===1&&norm(res[0])===q&&state.gab){acMk.innerHTML='';acMk.classList.remove('on');return;}
    acMk.innerHTML=res.slice(0,7).map(function(m){return '<button type="button" class="aci" data-mkonly="'+m+'"><b>'+m+'</b><span>'+Object.keys(VDB[m]).length+' modèles</span></button>';}).join('');
    acMk.classList.add('on');
    acMk.querySelectorAll('.aci').forEach(function(bt){bt.addEventListener('click',function(){
      state.marque=bt.dataset.mkonly;state.modele='';refreshGab();render();
      setTimeout(function(){var mm=document.getElementById('modele');if(mm)mm.focus();},30);
    });});
  }
  function refreshGab(){
    var g=detectGab(state.marque,state.modele);
    if(g){state.gab=g;state.gabAuto=true;}else{if(state.gabAuto){state.gab=null;state.gabAuto=false;}}
  }
  function suggest(){
    if(!acBox)return; var q=norm(state.modele), qm=norm(state.marque);
    var exactBrand=null;
    for(var bi=0;bi<BRANDS.length;bi++){if(norm(BRANDS[bi])===qm){exactBrand=BRANDS[bi];break;}}
    var res;
    if(exactBrand && q.length<1){
      res=Object.keys(VDB[exactBrand]).map(function(md){return {marque:exactBrand,modele:md,gab:VDB[exactBrand][md]};}).slice(0,8);
    } else {
      if((state.modele||'').trim().length<1){acBox.innerHTML='';acBox.classList.remove('on');return;}
      res=VLIST.filter(function(v){
        var okM=!qm||norm(v.marque).indexOf(qm)>-1;
        return okM && norm(v.modele).indexOf(q)>-1;
      }).slice(0,8);
    }
    if(!res.length){acBox.innerHTML='';acBox.classList.remove('on');return;}
    acBox.innerHTML=res.map(function(v){return '<button type="button" class="aci" data-mk="'+v.marque+'" data-md="'+v.modele+'"><b>'+v.marque+' '+v.modele+'</b><span>'+GABARITS[v.gab].label+'</span></button>';}).join('');
    acBox.classList.add('on');
    acBox.querySelectorAll('.aci').forEach(function(bt){bt.addEventListener('click',function(){
      state.marque=bt.dataset.mk;state.modele=bt.dataset.md;refreshGab();render();
    });});
  }
  if(inpM)inpM.addEventListener('focus',function(){suggestMk();});
  if(inpM)inpM.addEventListener('input',function(e){state.marque=e.target.value;refreshGab();suggestMk();suggest();});
  if(inpMod)inpMod.addEventListener('focus',function(){suggest();});
  if(inpMod)inpMod.addEventListener('input',function(e){state.modele=e.target.value;refreshGab();suggest();});

  document.addEventListener('click',function(e){
    if(acMk&&!e.target.closest('#acMk')&&e.target.id!=='marque'){acMk.classList.remove('on');}
    if(acBox&&!e.target.closest('#ac')&&e.target.id!=='modele'){acBox.classList.remove('on');}
  });
  panel.querySelectorAll('[data-gab]').forEach(function(bt){bt.addEventListener('click',function(){
    state.gab=bt.dataset.gab;state.gabAuto=false;
    render();
  });});
  var gchange=document.getElementById('gchange');
  if(gchange)gchange.addEventListener('click',function(){state.gabAuto=false;state.manualGab=true;render();});
  var noModel=document.getElementById('noModel');
  if(noModel)noModel.addEventListener('change',function(){if(noModel.checked){state.manualGab=true;render();}});

  bindCommon();
  var next=document.getElementById('next');
  if(next)next.addEventListener('click',function(){
    if(!validPrestationStep()){shakeNext();return;}
    if(step<last){step++;navDirection='fwd';render()}else{done()}
  });
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
})();
