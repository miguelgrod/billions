// Los 50 actores con más películas rodadas.
// Generado por tools/build-actores.py desde
// top_50_actores_numero_peliculas.xlsx — no editar a mano.
// n: nombre · p: nº de películas · f: archivo en actors/
// tol: margen de error en películas, según la fiabilidad que
//      declara el propio Excel (verificado 3, estimado 8,
//      provisional 15: esas fuentes mezclan cine y televisión)
const ACTORES_TOP = [
  { n: "Samuel L. Jackson", p: 150, tol: 3, f: "samuel-l-jackson.jpg" },   // verificado
  { n: "Robert De Niro", p: 136, tol: 3, f: "robert-de-niro.jpg" },   // verificado
  { n: "Bruce Willis", p: 131, tol: 3, f: "bruce-willis.jpg" },   // verificado
  { n: "Nicolas Cage", p: 116, tol: 3, f: "nicolas-cage.jpg" },   // verificado
  { n: "Keanu Reeves", p: 99, tol: 3, f: "keanu-reeves.jpg" },   // verificado
  { n: "Anthony Hopkins", p: 97, tol: 3, f: "anthony-hopkins.jpg" },   // verificado
  { n: "Tom Hanks", p: 96, tol: 3, f: "tom-hanks.jpg" },   // verificado
  { n: "Matt Damon", p: 85, tol: 3, f: "matt-damon.jpg" },   // verificado
  { n: "Dustin Hoffman", p: 82, tol: 15, f: "dustin-hoffman.jpg" },   // provisional
  { n: "Johnny Depp", p: 81, tol: 15, f: "johnny-depp.jpg" },   // provisional
  { n: "Jeff Bridges", p: 80, tol: 8, f: "jeff-bridges.jpg" },   // estimado
  { n: "Robert Downey Jr.", p: 80, tol: 15, f: "robert-downey-jr.jpg" },   // provisional
  { n: "Harrison Ford", p: 78, tol: 15, f: "harrison-ford.jpg" },   // provisional
  { n: "Meryl Streep", p: 77, tol: 3, f: "meryl-streep.jpg" },   // verificado
  { n: "Nicole Kidman", p: 77, tol: 3, f: "nicole-kidman.jpg" },   // verificado
  { n: "Clint Eastwood", p: 75, tol: 3, f: "clint-eastwood.jpg" },   // verificado
  { n: "Cate Blanchett", p: 74, tol: 15, f: "cate-blanchett.jpg" },   // provisional
  { n: "Jack Nicholson", p: 71, tol: 3, f: "jack-nicholson.jpg" },   // verificado
  { n: "Kurt Russell", p: 65, tol: 3, f: "kurt-russell.jpg" },   // verificado
  { n: "Scarlett Johansson", p: 65, tol: 15, f: "scarlett-johansson.jpg" },   // provisional
  { n: "Al Pacino", p: 65, tol: 15, f: "al-pacino.jpg" },   // provisional
  { n: "Brad Pitt", p: 61, tol: 3, f: "brad-pitt.jpg" },   // verificado
  { n: "Mark Ruffalo", p: 60, tol: 3, f: "mark-ruffalo.jpg" },   // verificado
  { n: "Denzel Washington", p: 58, tol: 3, f: "denzel-washington.jpg" },   // verificado
  { n: "Kate Winslet", p: 57, tol: 15, f: "kate-winslet.jpg" },   // provisional
  { n: "Penélope Cruz", p: 56, tol: 15, f: "penelope-cruz.jpg" },   // provisional
  { n: "Javier Bardem", p: 55, tol: 15, f: "javier-bardem.jpg" },   // provisional
  { n: "Russell Crowe", p: 54, tol: 3, f: "russell-crowe.jpg" },   // verificado
  { n: "Julia Roberts", p: 53, tol: 3, f: "julia-roberts.jpg" },   // verificado
  { n: "Colin Farrell", p: 53, tol: 3, f: "colin-farrell.jpg" },   // verificado
  { n: "Daniel Craig", p: 50, tol: 3, f: "daniel-craig.jpg" },   // verificado
  { n: "Gary Oldman", p: 50, tol: 8, f: "gary-oldman.jpg" },   // estimado
  { n: "Sandra Bullock", p: 49, tol: 3, f: "sandra-bullock.jpg" },   // verificado
  { n: "Joaquin Phoenix", p: 47, tol: 15, f: "joaquin-phoenix.jpg" },   // provisional
  { n: "Tom Cruise", p: 45, tol: 8, f: "tom-cruise.jpg" },   // estimado
  { n: "Edward Norton", p: 38, tol: 3, f: "edward-norton.jpg" },   // verificado
  { n: "Jennifer Lawrence", p: 32, tol: 3, f: "jennifer-lawrence.jpg" },   // verificado
  { n: "Ryan Gosling", p: 31, tol: 3, f: "ryan-gosling.jpg" },   // verificado
  { n: "Leonardo DiCaprio", p: 30, tol: 8, f: "leonardo-dicaprio.jpg" },   // estimado
];
