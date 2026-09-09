-- Seit dem 9. September rechnet jede Stadt ihr eigenes 250-m-Raster; der
-- Name des Rasters steht im Zellschlüssel (`hamburg:12_34`). Berlin behält
-- das alte Raster ohne Präfix, seine Zeilen bleiben gültig. Die Zeilen der
-- anderen Städte tragen Schlüssel des Berliner Rasters und lassen sich nicht
-- umrechnen — eine Markierung hält absichtlich keine Koordinate. Der Leser
-- verwirft sie ohnehin (falsches Präfix); hier gehen sie weg, damit die
-- Tabelle nicht 28 Tage lang Zeilen trägt, die niemand liest.
DELETE FROM marks WHERE city <> 'berlin';
