// Datos realistas de 3 semanas
// Lunes de la semana pasada: así el resumen semanal no aparece en medio de las pruebas
function lastMonday() { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7); const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }
module.exports = function fixture() {
  const z=n=>String(n).padStart(2,'0'); const key=d=>`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
  const days={}, weights=[], workouts=[];
  const menu=[['pollo','Pechuga de pollo asada (sin piel)','almuerzo',150,248,46,0,5],['arroz','Arroz blanco cocido','almuerzo',150,195,4,42,0.4],['avena','Avena en hojuelas','desayuno',50,190,6.5,33,3.4],['platano','Plátano','desayuno',120,107,1.3,27,0.4],['yogurt','Yogur griego natural entero','snack',170,165,15,6,8],['palta','Palta / aguacate','cena',60,96,1.2,5,8.8],['marraqueta','Marraqueta / pan francés','cena',100,270,9,55,1.5],['huevo','Huevo entero cocido','cena',100,155,13,1,11]];
  for(let i=0;i<21;i++){const d=new Date();d.setDate(d.getDate()-i);const k=key(d);
    const foods=menu.filter((_,j)=>i===0? j<4 : (i+j)%5!==0).map((m,j)=>({id:'f'+i+'_'+j,foodId:m[0],name:m[1],meal:m[2],grams:m[3],kcal:m[4]*(1+(i%3)*0.1),p:m[5],c:m[6],g:m[7]}));
    days[k]={foods,exercises:i%2?[{id:'e'+i,name:'Trotar (8 km/h)',minutes:35,kcal:380}]:[],water:i===0?3:6+(i%4)};
    if(i%3===0) weights.push({d:k,kg:+(82-(21-i)*0.08).toFixed(1)});
    if(i%2===1) workouts.push({id:'w'+i,d:k,name:'Cuerpo completo A',minutes:52,ex:[{id:'bench-press',sets:[{kg:40+(21-i),reps:10},{kg:40+(21-i),reps:9}]}]});
  }
  return {profile:{nombre:'Benja',sexo:'h',edad:30,altura:175,peso:80,actividad:1.55,objetivo:'perder',dieta:'equilibrada'},days,weights:weights.reverse(),workouts:workouts.reverse(),favFoods:['pollo','avena'],badges:['inicio','racha3','racha7','entreno1'],weeklySeen:lastMonday(),_ts:1};
};
