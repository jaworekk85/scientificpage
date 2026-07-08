# Pływy: notatki teoretyczne do modułu i odcinka

Status: szkic do opowiadania + planu implementacji

Ten plik ma być bazą do dwóch rzeczy:

- wyjaśnienia pływów w materiale wideo;
- zaprojektowania profesjonalniejszego modelu tidal locking / recession w aplikacji.

Najważniejsza myśl: obecny moduł pokazuje **gradient pływowy**, czyli różnicę przyspieszenia grawitacyjnego na powierzchni i w środku ciała. Żeby dostać blokowanie pływowe, tarcie, grzanie i recesję orbity, trzeba dodać osobną mechanikę spinu oraz model dyssypacji.

## 1. Czym naprawdę jest siła pływowa

Pływy nie są po prostu całkowitym przyciąganiem przez Księżyc, planetę albo gwiazdę.

Pływ to różnica między grawitacją działającą na różne części rozciągłego ciała.

Dla ciała o środku `r0`, punktu powierzchni `r0 + x` i zewnętrznego ciała o masie `M`:

```text
a_tide(x) = g(r0 + x) - g(r0)
```

Czyli patrzymy na przyspieszenie względem środka ciała.

Dla małego ciała w porównaniu z odległością do źródła:

```text
|a_tide| ~ G M R / d^3
```

a różnica między bliską i daleką stroną ma skalę:

```text
delta a_near-far ~ 2 G M R / d^3
```

W interfejsie aplikacji nazywamy tę wielkość `near-far tide delta a`.
To jest bazowy "tide"; wartości typu `near-far tide delta a / surface g` są
tylko normalizacją tej samej wielkości.

Tu `R` to promień deformowanego ciała, a `d` to odległość do źródła pływów.

Klucz: pływy skalują się jak `M / d^3`, a nie jak zwykła grawitacja `M / d^2`. Dlatego bliski obiekt może dominować pływy.

## 2. Dlaczego są dwa wybrzuszenia

W układzie związanym ze środkiem planety:

- strona bliższa Księżyca jest przyciągana mocniej niż środek, więc odchyla się na zewnątrz ku Księżycowi;
- strona dalsza jest przyciągana słabiej niż środek, więc względem środka też zostaje odchylona na zewnątrz;
- boki, prostopadłe do osi planeta-Księżyc, są ściskane.

Dlatego obraz pływów jest kwadrupolowy:

```text
rozciąganie wzdłuż osi źródła
ściskanie w dwóch kierunkach poprzecznych
```

To jest dokładnie to, co próbujemy pokazać w overlayu: strzałki gradientu plus spłaszczony/rozciągnięty obrys.

## 3. Tensor pływowy

Najbardziej eleganckie ujęcie:

```text
a_tide ~= T x
```

gdzie `T` to tensor pływowy, czyli gradient pola grawitacyjnego.

Dla punktowego źródła masy, jeśli oś `x` wskazuje w stronę źródła:

```text
T ~= (G M / d^3) diag(2, -1, -1)
```

To mówi:

- wzdłuż osi źródła: rozciąganie `+2`;
- w poprzek: ściskanie `-1` i `-1`;
- suma diagonalna wynosi zero poza źródłem masy, zgodnie z równaniem Laplace'a.

To dobry fragment do odcinka, bo jednym równaniem tłumaczy dwie wypukłości i boczne ściskanie.

## 4. Problem skali w wizualizacji

W aplikacji promienie ciał są powiększone, bo inaczej planet nie byłoby widać.

To jest dobre wizualnie, ale pływy zależą od promienia:

```text
a_tide ~ R / d^3
```

Jeśli używamy napompowanego promienia jako fizycznego promienia, pływy będą sztucznie duże.

Na razie trzeba to traktować jako model jakościowy. Profesjonalniejsza wersja powinna rozdzielić:

```text
visual radius
physical radius for tides / collisions
```

Do odcinka warto powiedzieć: "Na ekranie powiększam ciała, żeby było widać geometrię. Liczby pływowe są jakościowe, dopóki nie ustawimy spójnej skali fizycznej".

## 5. Równowagowe pływy

Gradient pływowy próbuje zdeformować ciało do kształtu równowagowego: wydłużonego wzdłuż osi źródła pływów.

Jeśli ciało reagowałoby idealnie natychmiast i bez strat, garb pływowy byłby dokładnie na osi planeta-Księżyc.

Wtedy mamy deformację, ale nie mamy długoterminowej recesji orbity ani blokowania spinu.

Żeby pojawił się transfer momentu pędu, potrzebne jest opóźnienie garbu pływowego. A opóźnienie bierze się z dyssypacji: tarcia wewnętrznego, lepkości, oceanów, skorupy, płaszcza itd.

## 6. Love numbers

Love numbers to bezwymiarowe współczynniki odpowiedzi ciała na zewnętrzny potencjał pływowy.

Najczęściej spotyka się stopień drugi, bo dominujący pływ jest kwadrupolowy:

```text
h2  radialne przemieszczenie powierzchni
l2  poziome przemieszczenie materiału
k2  zmiana potencjału grawitacyjnego wywołana deformacją
```

Dla ewolucji orbit najważniejszy jest zwykle `k2`, bo mówi, jak silny dodatkowy potencjał grawitacyjny tworzy zdeformowane ciało.

Intuicja:

- bardzo sztywne ciało ma małe Love numbers;
- ciało płynne albo łatwo deformowalne ma większe Love numbers;
- `k2 = 0` oznacza brak grawitacyjnej odpowiedzi deformacji;
- większe `k2` oznacza mocniejszy garb pływowy, który może działać momentem siły na orbitujące ciało.

## 7. Czynnik jakości Q

`Q` opisuje straty energii.

Ogólna intuicja z oscylatorów:

```text
duże Q  -> małe tłumienie, małe straty energii
małe Q  -> duże tłumienie, duże straty energii
```

W pływach:

```text
duże Q  -> słaba ewolucja pływowa
małe Q  -> silna ewolucja pływowa
```

Bardzo zgrubnie:

```text
1 / Q ~ ułamek energii tracony na radian cyklu
```

W prostych modelach z opóźnieniem fazowym spotyka się zależność:

```text
1 / Q ~ sin(2 epsilon) ~ 2 epsilon
```

dla małego kąta opóźnienia `epsilon`.

W praktyce często najważniejsza jest kombinacja:

```text
k2 / Q
```

bo `k2` mówi, jak duża jest odpowiedź ciała, a `Q` mówi, jaka część tej odpowiedzi jest stratna/dyssypacyjna.

## 8. Dlaczego opóźniony garb daje moment siły

Oznaczmy:

```text
Omega = prędkość kątowa obrotu ciała
n     = średni ruch orbitalny
```

Jeśli `Omega > n`, ciało obraca się szybciej niż orbita. Garb pływowy jest wynoszony przed linię łączącą środki. Towarzysz przyciąga ten garb i hamuje spin.

Skutek:

```text
spin traci moment pędu
orbita zyskuje moment pędu
półos wielka rośnie
```

To jest intuicja recesji Księżyca od Ziemi.

Jeśli `Omega < n`, garb zostaje za linią łączącą środki.

Skutek:

```text
spin zyskuje moment pędu
orbita traci moment pędu
półos wielka maleje
```

Dla obrotu wstecznego sytuacja jest jeszcze bardziej hamująca: pływy próbują wyhamować retrograde spin i doprowadzić do ruchu zgodnego/synchronicznego.

## 9. Jakie równania musimy dodać

Obecny N-body w aplikacji ma stan punktowych mas:

```text
r_i' = v_i
v_i' = grawitacja od innych ciał
```

To nie wystarczy do tidal locking.

Musimy dodać spin:

```text
theta_i' = Omega_i
Omega_i' = tau_tide / I_i
```

gdzie:

```text
theta_i   kąt obrotu
Omega_i   prędkość kątowa spinu
I_i       moment bezwładności
tau_tide  moment siły od pływów
```

Moment bezwładności można modelować jako:

```text
I = alpha M R^2
```

Dla jednorodnej kuli `alpha = 2/5`, ale planety nie są jednorodne, więc `alpha` powinno być parametrem.

## 10. Minimalny model momentu pływowego

Do dydaktyki dobry jest model typu constant time lag:

```text
tau_spin = -C (Omega - n)
```

gdzie:

```text
C ~ k2 G m_companion^2 R^5 Delta_t / a^6
```

Uwaga: dokładny czynnik liczbowy zależy od konwencji i modelu pływów. Do aplikacji możemy zacząć od poprawnego znaku i skalowania, a współczynnik opisać jako uproszczoną siłę sprzężenia.

Znak:

```text
Omega > n  -> tau_spin < 0  -> spin zwalnia
Omega < n  -> tau_spin > 0  -> spin przyspiesza
```

Żeby recesja orbity wynikała z równań, musimy oddać przeciwny moment pędu orbicie:

```text
L_orbit' = -tau_spin
```

Dla kołowej orbity dwóch ciał:

```text
L_orbit = mu sqrt(G M_total a)
```

więc:

```text
a' = 2 a (L_orbit' / L_orbit)
```

Wtedy `a` rośnie albo maleje jako wynik równania, a nie jako ręczna animacja.

## 11. Energia i moment pędu

W pływach mechaniczna energia nie jest zachowana, bo część energii zamienia się w ciepło.

Ale w izolowanym układzie spin-orbit całkowity moment pędu powinien się zgadzać:

```text
L_total = L_orbit + I Omega
```

Dlatego profesjonalna wizualizacja powinna mieć wykres:

```text
L_orbit
L_spin
L_total
energy dissipated / heat proxy
```

To bardzo dobrze pokazuje różnicę:

- energia mechaniczna maleje;
- moment pędu jest przekazywany między spinem i orbitą.

## 12. Constant Q kontra constant time lag

Dwie popularne rodziny uproszczeń:

```text
constant Q / constant phase lag
constant time lag Delta_t
```

Model constant Q jest intuicyjny, bo `Q` ma jasne znaczenie strat energii, ale bywa kłopotliwy blisko synchronizacji.

Model constant time lag jest często wygodniejszy w symulacji dydaktycznej:

```text
lag angle ~= (Omega - n) Delta_t
```

Torque naturalnie znika, gdy:

```text
Omega -> n
```

Rekomendacja dla aplikacji:

```text
wewnętrznie zacząć od constant time lag
w UI pokazać k2 i parametr dissipation/Q-like
```

## 13. Orbity ekscentryczne i grzanie pływowe

Dla orbity ekscentrycznej odległość zmienia się w czasie.

Ponieważ:

```text
a_tide ~ 1 / d^3
```

pływy są najsilniejsze w perycentrum.

Ekscentryczna orbita powoduje cykliczne rozciąganie i ściskanie ciała. Jeśli ciało ma straty wewnętrzne, energia mechaniczna zamienia się w ciepło:

```text
ekscentryczność + dyssypacja -> grzanie pływowe + cyrkularyzacja orbity
```

Jeśli inne ciała lub rezonanse stale podtrzymują ekscentryczność, grzanie może trwać długo. Klasyczna intuicja: Io.

## 14. Co dokładnie chcemy zaimplementować

### Etap A: obecny moduł gradientu

Już mamy:

- gradient pływowy dla wybranego ciała;
- strzałki lokalnego `delta a` w punktach powierzchni;
- obrys pływowy;
- wykres `near-far tide delta a / surface g`;
- wskaźnik `current / orbit peak`, czyli aktualna siła pływu względem maksimum na obecnej trajektorii;
- ekscentryczny preset pływowy;
- pierwszy planar model wymiany spin-orbit: `spinOmega`, `spinPhase`, torque, `bulk spin L`, `orbit L`, heat;
- parametry UI aktywne przy modelu spin-orbit: `k2`, lag, inertia alpha.

To tłumaczy, czym pływy są geometrycznie.

Uwaga wizualizacyjna: strzałki pokazują prawdziwe kierunki lokalnego `delta a`, ale ich długość jest skalowana względem największej strzałki na całej aktualnie policzonej trajektorii. To jest celowe: w presecie ekscentrycznym pływy powinny słabnąć daleko od perycentrum i wzmacniać się blisko perycentrum. Skala per-klatka ukrywałaby ten efekt.

### Etap B: model kołowy wymiany spin-orbit

Stan:

```text
a
theta
Omega
```

Równania:

```text
n = sqrt(G M_total / a^3)
tau = -C (Omega - n)
Omega' = tau / I
L_orbit' = -tau
a' = 2 a L_orbit' / L_orbit
```

Wykresy:

```text
Omega / n
a
L_spin
L_orbit
L_total
heat proxy
```

To jest pierwszy moment, w którym recesja/decay wychodzi z równań, a nie z kosmetycznej krzywej. Obecna implementacja jest jeszcze dydaktycznie uproszczona i wymaga kalibracji parametrów, ale ma właściwy bilans: bulk spin wybranego ciała wymienia moment pędu z orbitą, a utrata energii mechanicznej jest zapisywana jako heat.

Minimalne parametry UI dla tego etapu:

```text
moment of inertia factor alpha
Love number k2
dissipation / time lag
initial spin Omega
```

W UI mamy teraz pierwszą wersję: `k2`, lag i inertia alpha. W kolejnej warstwie można mówić o `Q` jako intuicyjnym "jak słabe są straty", ale numerycznie lepiej zaczynać od constant time lag, bo zachowuje się łagodniej blisko synchronizacji.

### Etap C: ekscentryczność i grzanie

Dodać:

```text
e
e' < 0 przez dyssypację
heating proxy zależny od e^2 i siły pływów
```

Ten etap trzeba wyraźnie podpisać jako model uśredniony, nie pełny trójwymiarowy model geofizyczny.

### Etap D: Roche limit

Najpierw wizualizacja, bez niszczenia ciała:

```text
d_roche,fluid ~= 2.44 R_primary (rho_primary / rho_body)^(1/3)
d_roche,rigid ~= 1.26 R_primary (rho_primary / rho_body)^(1/3)
```

W aplikacji:

- pierścień/sfera Roche'a wokół dominującego ciała;
- przełącznik fluid/rigid albo oba progi naraz;
- wykres `distance / Roche limit`;
- ostrzeżenie, gdy ciało wchodzi pod granicę;
- dopiero później opcjonalny tryb rozpadu na fragmenty.

Stan w aplikacji: pierwszy pass wizualizacji Roche'a jest zaimplementowany z opcjonalnym uproszczonym rozpadem. Dla zaznaczonego ciala bierzemy to samo dominujace zrodlo plywow, ktore maksymalizuje `G M / r^3`; wokol tego zrodla rysujemy granice fluid i/lub rigid, panel pokazuje oba promienie oraz `distance / limit`, a trzeci wykres moze pokazac przejscie przez prog `1`.

Rozpad nie jest natychmiastowa bramka przy przekroczeniu linii. Aplikacja liczy akumulowane `tidal damage` ze skala czasu `t_dyn ~= sqrt(R^3 / G M)`: krotki przelot moze zostawic tylko uszkodzenie, a dluzsze przebywanie pod granica doprowadza do `damage >= 1`. Breakup jest liczony globalnie dla aktywnych cial niebedacych gwiazdami, ale panel i wykres `tidal damage` pokazuja aktualnie zaznaczone cialo. Po rozpadzie zwarte cialo znika z trajektorii i jest pokazane jako jeden zaznaczalny debris-field. Debris ma tryby: tracer cloud bez back-reaction, collective mass z oddzialywaniem srodka masy chmury na zwarte ciala, oraz fragment N-body dla malej liczby fragmentow `N_frag <= n0`, gdzie fragmenty przyciagaja sie wzajemnie i dzialaja grawitacyjnie na zwarte ciala. To nadal model dydaktyczny, nie solver pekania materialu, zderzen fragmentow ani hydrodynamiki.

## 15. Proponowana narracja do odcinka

1. Grawitacja nie jest identyczna w każdym punkcie planety.
2. Pływ to różnica grawitacji względem środka.
3. Dlatego są dwa wybrzuszenia, nie jedno.
4. Idealnie natychmiastowy pływ nie daje długoterminowego hamowania.
5. Realne ciało ma straty, więc garb jest przesunięty.
6. Przesunięty garb daje moment siły.
7. Moment siły przenosi moment pędu między spinem i orbitą.
8. `k2` mówi, jak mocno ciało odpowiada.
9. `Q` mówi, jak bardzo odpowiedź jest stratna.
10. Kierunek ewolucji zależy od tego, czy spin jest szybszy czy wolniejszy od orbity.

## 16. Ostrzeżenia do uczciwego opisu

- Nie wolno sprzedawać przeskalowanej wizualizacji jako realistycznych liczb.
- Trzeba odróżnić gradient pływowy od pływowej ewolucji orbity.
- Tidal locking nie wynika z samego punktowego N-body.
- Bez dyssypacji nie ma sekularnej recesji orbity.
- Dokładne współczynniki torque zależą od modelu pływów.
- Parametry `k2` i `Q` są często słabo znane dla realnych ciał.

## Źródła i dalsze czytanie

- Love numbers, definicje `h`, `k`, `l`: https://en.wikipedia.org/wiki/Love_number
- Quality factor `Q` jako pojęcie tłumienia: https://en.wikipedia.org/wiki/Q_factor
- Tidal locking i zależność czasu blokowania od `k2`, `Q`, `a^6`, `R^5`: https://en.wikipedia.org/wiki/Tidal_locking
- Tidal heating i rola ekscentryczności: https://en.wikipedia.org/wiki/Tidal_heating
- Valery Lainey, "Quantification of tidal parameters from Solar system data": https://arxiv.org/abs/1604.04184
- Michael Efroimsky, James G. Williams, "Tidal torques. A critical review of some techniques": https://arxiv.org/abs/0803.3299
- Murray and Dermott, *Solar System Dynamics*, Cambridge University Press.
