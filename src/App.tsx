import { useEffect, useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const imagesToGenerate = [
  {
    filename: 'cover.webp',
    prompt: 'A cinematic, dark, moody shot of an exhausted bartender leaning on a bar counter late at night, surrounded by dirty glasses, looking cynical and tired, emerald green neon lights reflecting, realistic style, high detail, 8k.'
  },
  {
    filename: 'bar_scheme.webp',
    prompt: 'A humorous, chaotic diagram or blueprint of a bar layout, marked with danger zones labeled "Hell", "Sticky Floor", "Angry Customer Zone", hand-drawn style on dark paper, white and green chalk lines.'
  },
  {
    filename: 'fake_smile.webp',
    prompt: 'A close-up of a bartender with a painfully fake, forced smile, dead eyes, holding a cocktail shaker, dark bar background with subtle green ambient lighting, dramatic lighting, cinematic portrait.'
  },
  {
    filename: 'alcohol_shelf.webp',
    prompt: 'A dimly lit, impressive shelf of liquor bottles in a bar, looking expensive and intimidating, with some bottles glowing slightly green, cinematic photography, depth of field.'
  },
  {
    filename: 'shaking_fail.webp',
    prompt: 'A dynamic action shot of a bartender shaking a cocktail shaker violently and clumsily, ice flying everywhere, looking panicked, comic book style or exaggerated realism with green accents.'
  },
  {
    filename: 'tears.webp',
    prompt: 'A close-up of a spilled cocktail on a bar counter that looks like a puddle of tears, with a small violin next to it, artistic and moody, dark lighting with emerald tint.'
  },
  {
    filename: 'building_drink.webp',
    prompt: 'A close-up of a bartender pouring a clear liquid into a highball glass filled with ice cubes, simple and clean, dark background with emerald green accents, cinematic lighting, realistic.'
  },
  {
    filename: 'stirring_drink.webp',
    prompt: 'A close-up of a crystal mixing glass with ice and red liquid, a long twisted metal bar spoon stirring it gently, elegant and sophisticated, dark moody bar atmosphere, emerald tint.'
  },
  {
    filename: 'muddling_mint.webp',
    prompt: 'A close-up of a wooden muddler crushing fresh green mint leaves and lime wedges in a sturdy glass, dynamic action, splashing juice, dark background, high detail.'
  }
];

export default function App() {
  const [generating, setGenerating] = useState(false);
  const [imageStatus, setImageStatus] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'cocktails' | 'non-alcoholic' | 'hot'>('cocktails');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleDownloadHTML = () => {
    const htmlContent = document.documentElement.outerHTML;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'barmanska-prirucka.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog("HTML stiahnuté.");
  };

  const handleGeneratePDF = async (action: 'download' | 'preview') => {
    setDownloading(true);
    addLog(action === 'download' ? "Generujem PDF..." : "Pripravujem náhľad PDF...");
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);

      // Fetch font CSS manually to avoid CORS issues with html-to-image
      const fontUrl = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Source+Sans+Pro:ital,wght@0,400;0,600;1,400&display=swap';
      let fontCss = '';
      try {
        const res = await fetch(fontUrl);
        if (res.ok) {
          fontCss = await res.text();
        }
      } catch (e) {
        console.warn("Failed to fetch font CSS", e);
      }

      // Helper to add element to PDF
      const addElementToPDF = async (element: HTMLElement, isFirstPage = false) => {
        if (!isFirstPage) pdf.addPage();
        
        const dataUrl = await toPng(element, {
          backgroundColor: '#050505',
          pixelRatio: 2,
          filter: (node) => {
            // Filter out the Google Fonts link to prevent CORS errors
            if (node instanceof HTMLLinkElement && node.href.includes('fonts.googleapis.com')) {
              return false;
            }
            return true;
          },
          fontEmbedCSS: fontCss,
        });

        const imgProps = pdf.getImageProperties(dataUrl);
        const pdfWidth = contentWidth;
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // Center vertically if it's small, or start from top
        let yPos = margin;
        if (pdfHeight < pageHeight - (margin * 2)) {
           // yPos = (pageHeight - imgHeight) / 2; // Center vertically
        }
        
        pdf.addImage(dataUrl, 'PNG', margin, yPos, pdfWidth, pdfHeight);
      };

      // 1. Cover Page
      const coverPage = document.querySelector('.cover-page') as HTMLElement;
      if (coverPage) {
        await addElementToPDF(coverPage, true);
      }

      // 2. Chapters
      const chapters = document.querySelectorAll('.chapter');
      for (let i = 0; i < chapters.length; i++) {
        await addElementToPDF(chapters[i] as HTMLElement);
      }

      if (action === 'download') {
        pdf.save('barmanska-prirucka.pdf');
        addLog("PDF stiahnuté.");
      } else {
        const pdfBlobUrl = pdf.output('bloburl');
        setPdfPreviewUrl(pdfBlobUrl);
        setShowPreview(true);
        addLog("Náhľad pripravený.");
      }
    } catch (error) {
      console.error("PDF generation failed:", error);
      addLog("Chyba pri generovaní PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const generateImages = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      addLog("Error: No API key found in environment variables.");
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    setGenerating(true);
    addLog(forceRegenerate ? "Starting FORCED image generation..." : "Starting image generation...");

    for (const img of imagesToGenerate) {
        if (!forceRegenerate) {
          // Check if WEBP exists
          try {
            const checkRes = await fetch(`/api/check-image/${img.filename}`);
            if (checkRes.ok) {
              const { exists } = await checkRes.json();
              if (exists) {
                addLog(`Image ${img.filename} already exists.`);
                setImageStatus(prev => ({ ...prev, [img.filename]: 'exists' }));
                continue;
              }
            }
          } catch (e) {
            console.warn("Failed to check image existence, proceeding to generate", e);
          }

          // Check if PNG exists and convert if so
          const pngFilename = img.filename.replace('.webp', '.png');
          try {
            const checkPngRes = await fetch(`/api/check-image/${pngFilename}`);
            if (checkPngRes.ok) {
              const { exists } = await checkPngRes.json();
              if (exists) {
                addLog(`Found ${pngFilename}, converting to WebP...`);
                const convertRes = await fetch('/api/convert-to-webp', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    sourceFilename: pngFilename, 
                    targetFilename: img.filename 
                  }),
                });
                
                if (convertRes.ok) {
                  addLog(`Converted ${pngFilename} to ${img.filename}`);
                  setImageStatus(prev => ({ ...prev, [img.filename]: 'saved' }));
                  continue;
                } else {
                   addLog(`Failed to convert ${pngFilename}, falling back to generation.`);
                }
              }
            }
          } catch (e) {
             console.warn("Failed to check/convert PNG", e);
          }
        }

        let attempts = 0;
        let success = false;
        const maxAttempts = 10;

        while (attempts < maxAttempts && !success) {
          attempts++;
          try {
            addLog(`Generating ${img.filename} (Attempt ${attempts}/${maxAttempts})...`);
            setImageStatus(prev => ({ ...prev, [img.filename]: 'generating' }));
            
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: { parts: [{ text: img.prompt }] },
            });

            let base64Data = null;
            if (response.candidates?.[0]?.content?.parts) {
              for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                  base64Data = part.inlineData.data;
                  break;
                }
              }
            }

            if (base64Data) {
              const saveRes = await fetch('/api/save-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: img.filename, base64Data }),
              });

              if (!saveRes.ok) {
                throw new Error(`Failed to save image: ${saveRes.statusText}`);
              }

              addLog(`Saved ${img.filename}`);
              setImageStatus(prev => ({ ...prev, [img.filename]: 'saved' }));
              success = true;
              
              // Add a delay between successful requests to avoid rate limits
              if (img !== imagesToGenerate[imagesToGenerate.length - 1]) {
                 addLog("Waiting 15 seconds before next image...");
                 await new Promise(resolve => setTimeout(resolve, 15000));
              }
            } else {
              throw new Error("No image data received from API");
            }
          } catch (error: any) {
            console.error(`Error generating ${img.filename} (Attempt ${attempts}):`, error);
            if (attempts === maxAttempts) {
              addLog(`Failed to generate ${img.filename} after ${maxAttempts} attempts. Using placeholder.`);
              
              // Generate placeholder locally
              try {
                const canvas = document.createElement('canvas');
                canvas.width = 1024;
                canvas.height = 1024;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.fillStyle = '#111827'; // gray-900
                  ctx.fillRect(0, 0, 1024, 1024);
                  
                  ctx.strokeStyle = '#059669'; // emerald-600
                  ctx.lineWidth = 20;
                  ctx.strokeRect(10, 10, 1004, 1004);

                  ctx.fillStyle = '#10b981'; // emerald-500
                  ctx.font = 'bold 60px sans-serif';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(img.filename, 512, 450);
                  
                  ctx.fillStyle = '#6b7280'; // gray-500
                  ctx.font = '40px sans-serif';
                  ctx.fillText("Image Generation Failed", 512, 550);
                  ctx.fillText("(Quota Exceeded)", 512, 600);
                }
                const placeholderData = canvas.toDataURL('image/png').split(',')[1];

                await fetch('/api/save-image', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ filename: img.filename, base64Data: placeholderData }),
                });
                
                setImageStatus(prev => ({ ...prev, [img.filename]: 'saved' }));
                addLog(`Saved placeholder for ${img.filename}`);
              } catch (e) {
                console.error("Failed to save placeholder", e);
                setImageStatus(prev => ({ ...prev, [img.filename]: 'error' }));
              }
            } else {
              // Check for 429 error OR specific 500 RPC error which often behaves like a temporary overload
              const isRateLimit = error?.message?.includes('429') || 
                                  error?.toString().includes('429') || 
                                  error?.toString().includes('RESOURCE_EXHAUSTED') ||
                                  error?.message?.includes('Rpc failed');
              
              let delay;
              if (isRateLimit) {
                 // Very aggressive delay for rate limits: 60s base + 10s per attempt
                 // Attempt 1: 70s, Attempt 2: 80s, etc.
                 delay = 60000 + (attempts * 10000);
                 addLog(`Rate limit or Server Busy (Attempt ${attempts}). Pausing for ${delay / 1000}s...`);
              } else {
                 // Standard exponential backoff: 2s, 4s, 8s...
                 delay = 2000 * Math.pow(2, attempts - 1);
                 addLog(`Error: ${error}. Retrying ${img.filename} in ${delay / 1000}s...`);
              }
              
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
    }
    setGenerating(false);
    addLog("Generation complete.");
  };

  useEffect(() => {
    generateImages();
  }, []);

  return (
    <div className="antialiased selection:bg-emerald-900 selection:text-white bg-[#050505]">
      {/* PDF Preview Modal */}
      {showPreview && pdfPreviewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-gray-900 w-full max-w-6xl h-[90vh] rounded-xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-900">
              <h3 className="text-white font-bold text-lg">Náhľad PDF</h3>
              <div className="flex gap-2">
                <a 
                  href={pdfPreviewUrl} 
                  download="barmanska-prirucka.pdf"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm font-bold transition-colors"
                >
                  Stiahnuť
                </a>
                <button 
                  onClick={() => setShowPreview(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-bold transition-colors"
                >
                  Zavrieť
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-800 relative">
              <iframe 
                src={pdfPreviewUrl} 
                className="w-full h-full border-none"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      {generating && (
        <div className="fixed top-0 left-0 w-full h-1 bg-gray-800 z-50">
          <div className="h-full bg-emerald-500 animate-pulse w-full"></div>
        </div>
      )}
      


      {/* COVER PAGE */}
      <header className="cover-page">
        <div className="absolute top-4 right-4 flex gap-2 z-50 no-print">
          <button
            onClick={() => handleGeneratePDF('preview')}
            disabled={downloading}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? 'Generujem...' : 'Náhľad PDF'}
          </button>
          <button
            onClick={() => handleGeneratePDF('download')}
            disabled={downloading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? 'Generujem...' : 'Stiahnuť PDF'}
          </button>
          <button
            onClick={handleDownloadHTML}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-bold transition-colors"
          >
            Stiahnuť HTML
          </button>
        </div>

        <h3 className="text-emerald-600 tracking-widest uppercase text-sm font-semibold mb-4">
          Neoficiálny manuál pre prežitie
        </h3>
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          Barmanská príručka <br />
          <span className="text-emerald-500 italic font-normal">
            pre naivných nováčikov
          </span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto italic mb-12">
          "Alebo prečo si si mal, preboha, radšej nájsť prácu v kancli"
        </p>

        <div className="w-full max-w-lg mx-auto h-64 flex items-center justify-center overflow-hidden rounded-lg shadow-2xl border border-gray-700">
          <img 
            src={`/images/cover.webp?t=${imageStatus['cover.webp'] === 'saved' ? Date.now() : '1'}`}
            alt="Zničený barman" 
            className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1f2937/10b981?text=Generujem...';
            }}
          />
        </div>
      </header>

      <main className="max-w-3xl mx-auto bg-[#050505]">
        {/* OBSAH */}
        <section className="chapter">
          <h2 className="chapter-title">Obsah</h2>
          <ul className="space-y-2 text-lg">
            <li>
              <a href="#uvod" className="text-emerald-500 hover:text-emerald-400 hover:underline transition-colors">
                Úvod: Vitajte v pekle
              </a>
            </li>
            <li>
              <a href="#pravidlo-1" className="text-emerald-500 hover:text-emerald-400 hover:underline transition-colors">
                Pravidlo #1: Prežitie za barom
              </a>
            </li>
            <li>
              <a href="#pravidlo-2" className="text-emerald-500 hover:text-emerald-400 hover:underline transition-colors">
                Pravidlo #2: Divadlo pre opilcov
              </a>
            </li>
            <li>
              <a href="#pravidlo-3" className="text-emerald-500 hover:text-emerald-400 hover:underline transition-colors">
                Pravidlo #3: Jedovatý arzenál
              </a>
            </li>
            <li>
              <a href="#pravidlo-4" className="text-emerald-500 hover:text-emerald-400 hover:underline transition-colors">
                Pravidlo #4: Anatómia opice
              </a>
            </li>
            <li>
              <a href="#pravidlo-5" className="text-emerald-500 hover:text-emerald-400 hover:underline transition-colors">
                Pravidlo #5: Fyzika pre zúfalcov
              </a>
            </li>
            <li>
              <a href="#pravidlo-6" className="text-emerald-500 hover:text-emerald-400 hover:underline transition-colors">
                Pravidlo #6: Črepy prinášajú šťastie
              </a>
            </li>
            <li>
              <a href="#pravidlo-7" className="text-emerald-500 hover:text-emerald-400 hover:underline transition-colors">
                Pravidlo #7: Krízový manažment
              </a>
            </li>
            <li>
              <a href="#faq" className="text-emerald-500 hover:text-emerald-400 hover:underline transition-colors">
                FAQ: Časté otázky
              </a>
            </li>
            <li>
              <a href="#slovnik" className="text-emerald-500 hover:text-emerald-400 hover:underline transition-colors">
                Slovník bolesti
              </a>
            </li>
            <li>
              <a href="#zaver" className="text-emerald-500 hover:text-emerald-400 hover:underline transition-colors">
                Záver
              </a>
            </li>
          </ul>
        </section>

        {/* ÚVOD */}
        <section id="uvod" className="chapter">
          <h2 className="chapter-title">Úvod: Vitajte v pekle</h2>

          <p className="mb-4 text-lg">
            Takže ty chceš byť barman. Videl si pár videí na TikToku, kde nejaký
            potetovaný hipster so zakrútenými fúzmi čaruje s dymom, alebo si si
            nebodaj pozrel starý film <em>Cocktail</em> s Tomom Cruisom a
            povedal si si:{" "}
            <span className="text-white">
              "To je ono! Budem hviezdou nočného života!"
            </span>
          </p>

          <p className="mb-4 text-lg">
            Sadni si, kamoš. Daj si pohár vody a počúvaj.
          </p>

          <div className="cynical-quote">
            Vitaj vo svete chronickej nespavosti, topánok, ktoré sa lepia k
            podlahe bez ohľadu na to, koľkokrát ju umyješ, a úsmevov takých
            falošných a vytrénovaných, že by sa za ne nehanbil ani sériový vrah
            na rodinnej oslave.
          </div>

          <p className="mb-4 text-lg">
            Toto nie je párty. Toto je pásová výroba ilúzií, kde ty si ten
            idiot, čo do nej sype uhlie. Po pätnástich rokoch a tisíckach
            piatkových nočných smien ti môžem garantovať dve veci: tvoje kolená
            ťa budú nenávidieť a stratíš akúkoľvek vieru v zdravý rozum ľudstva.
          </p>

          <p className="text-lg text-emerald-500 font-semibold">
            Napriek tomu si tu. Takže ak už máš trpieť, aspoň ťa naučím, ako pri
            tom vyzerať ako absolútny profesionál.
          </p>
        </section>

        {/* PRAVIDLO 1 */}
        <section id="pravidlo-1" className="chapter">
          <h2 className="chapter-title">Pravidlo #1: Prežitie za barom</h2>
          <p className="italic text-gray-500 mb-6">
            Základy správania sa v pracovnom priestore
          </p>

          <div className="my-8 overflow-hidden rounded-lg border border-gray-800 shadow-lg shadow-black/50">
            <img 
              src={`/images/bar_scheme.webp?t=${imageStatus['bar_scheme.webp'] === 'saved' ? Date.now() : '1'}`}
              alt="Schéma baru" 
              className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/050505/10b981?text=Generujem...';
              }}
            />
            <p className="text-center text-xs text-gray-600 mt-2 italic">Obr. 1: Mínové pole, ktorému hovoríme pracovisko</p>
          </div>

          <p className="mb-6 text-lg">
            Bar nie je pódium. Bar je ponorka, ktorá práve dostala zásah
            torpédom, a my všetci sa snažíme udržať ju nad vodou. Tu sú pravidlá
            prežitia:
          </p>

          <ul className="space-y-6">
            <li className="flex items-start">
              <span className="text-emerald-500 text-2xl mr-4 mt-1">⚔️</span>
              <div>
                <strong className="text-white text-xl block mb-1">
                  Tanec smrti (Pravidlo "ZA TEBOU!")
                </strong>
                Priestor za barom má šírku tvojich ramien a ego tvojich kolegov
                je ešte širšie. Ak urobíš krok dozadu bez toho, aby si zareval{" "}
                <strong>"Za tebou!"</strong>, narazíš do mňa, ja vylejem
                osemeurový drink a garantujem ti, že ťa na mieste prebodnem
                barmanskou lyžičkou. Komunikuj. Sme prepojený organizmus.
              </div>
            </li>
            <li className="flex items-start">
              <span className="text-emerald-500 text-2xl mr-4 mt-1">🧭</span>
              <div>
                <strong className="text-white text-xl block mb-1">
                  Mise en place
                </strong>
                <em>(alebo "ak mi nevrátiš jigger na miesto, odseknem ti ruku")</em>
                <br />
                Tvoja pracovná stanica je tvoj chrám. Všetko má svoje posvätné,
                nemenné miesto. Ak zoberieš fľašu, vrátiš ju tam, odkiaľ si ju
                vzal. Etiketou dopredu. Ak budem v najväčšej špičke siahať
                naslepo po bitteroch a nenájdem ich tam, kde majú byť, tvoja
                zmena sa predčasne končí. Tvoja efektivita je priamo úmerná
                tvojej organizácii.
              </div>
            </li>
            <li className="flex items-start">
              <span className="text-emerald-500 text-2xl mr-4 mt-1">🧽</span>
              <div>
                <strong className="text-white text-xl block mb-1">
                  Čistota (Prečo je lepkavý bar tvoja vizitka)
                </strong>
                Zákazník si možno nepamätá, aký gin si mu nalial do toniku, ale
                pamätá si, že sa mu k stolu prilepil lakeť. Neustále utieraj. Ak
                máš čas opierať sa, máš čas upratovať. Tvoja pracovná doska musí
                byť taká čistá, aby som z nej mohol zjesť tatarák.
              </div>
            </li>
          </ul>
        </section>

        {/* PRAVIDLO 2 */}
        <section id="pravidlo-2" className="chapter">
          <h2 className="chapter-title">Pravidlo #2: Divadlo pre opilcov</h2>
          <p className="italic text-gray-500 mb-6">
            Správne vystupovanie a komunikácia
          </p>

          <p className="mb-6 text-lg">
            Tvojou prácou nie je len nalievať tekutiny do pohárov. Tvojou prácou
            je manažovať zvieratá v zoo, len s tým rozdielom, že tieto zvieratá
            majú platobné karty.
          </p>

          <div className="space-y-6">
            <div className="bg-gray-900 p-6 rounded-lg border-l-4 border-emerald-600">
              <h4 className="text-xl text-white mb-2 font-semibold">
                Alchýmia bláznovstva
              </h4>
              <p>
                Skôr či neskôr k tebe príde nejaká slečna alebo namachrovaný
                chalan a povie:{" "}
                <em>
                  "Chcem niečo, kde vôbec nebudem cítiť alkohol, ale aby ma to
                  rýchlo opilo."
                </em>{" "}
                Tvoj vnútorný hlas by najradšej kričal, ale tvoj vonkajší herec
                len s úsmevom prikývne a namieša Vodku s toľkým brusnicovým
                džúsom a limetou, že to bude chutiť ako detská výživa.
                Nekritizuj. Kasíruj.
              </p>
            </div>

            <div className="bg-gray-900 p-6 rounded-lg border-l-4 border-emerald-600">
              <h4 className="text-xl text-white mb-2 font-semibold">
                Stopka s gráciou
              </h4>
              <p>
                Odmietnuť naliať človeku, ktorý sa drží baru len preto, aby
                nespadol pod vplyvom gravitácie, je umenie. Žiadne hádky. Žiadne
                moralizovanie. Povieš s úsmevom, ktorý je pevný ako betón:{" "}
                <em>
                  "Kamoš, pre dnešok si vyhral. Tu máš pohár vody na môj účet,
                  kartu máš uzavretú, vidíme sa nabudúce."
                </em>{" "}
                Ak začne byť agresívny, nerieš to ty. Na to máme vyhadzovačov.
              </p>
            </div>

            <div className="cynical-quote mt-8">
              Za barom sa NIKDY neopieraš. Nikdy si nepozeráš do mobilu. Si na
              javisku. A pamätaj na sväté pravidlo: hosť, ktorý na teba lúska
              prstami, má byť ignorovaný rýchlejšie ako tvoje novoročné
              predsavzatia. Sme barmani, nie poslušné šteniatka.
            </div>
          </div>

          <div className="my-8 overflow-hidden rounded-lg border border-gray-800 shadow-lg shadow-black/50">
            <img 
              src={`/images/fake_smile.webp?t=${imageStatus['fake_smile.webp'] === 'saved' ? Date.now() : '1'}`}
              alt="Falošný úsmev" 
              className="w-full h-auto object-cover grayscale hover:grayscale-0 hover:scale-105 transition-all duration-500"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/050505/10b981?text=Generujem...';
              }}
            />
            <p className="text-center text-xs text-gray-600 mt-2 italic">Tvoja tvár, keď si niekto objedná Mojito 5 minút pred záverečnou</p>
          </div>
        </section>

        {/* PRAVIDLO 3 */}
        <section id="pravidlo-3" className="chapter">
          <h2 className="chapter-title">Pravidlo #3: Jedovatý arzenál</h2>
          <p className="italic text-gray-500 mb-6">
            Základné kategórie alkoholu
          </p>

          <p className="mb-6 text-lg">
            Skôr než niečo namiešaš, musíš vedieť, s akým jedom vlastne
            pracuješ. Tu je prehľad tvojich zbraní, zbavený marketingových
            žvástov.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-900 rounded border border-gray-800 hover:border-emerald-600 transition">
              <h4 className="text-lg text-white font-bold mb-2">Vodka</h4>
              <p className="text-sm">
                Číra, bez chuti, bez zápachu. Nástroj pre ľudí, ktorí nenávidia
                chuť alkoholu, ale milujú pocit, keď si necítia tvár. Riedidlo
                pre nerozhodných.
              </p>
            </div>
            <div className="p-4 bg-gray-900 rounded border border-gray-800 hover:border-emerald-600 transition">
              <h4 className="text-lg text-white font-bold mb-2">Gin</h4>
              <p className="text-sm">
                Hipsterská vodka, ktorá strávila noc v lese. Dnes sa robí aj
                ružový, ale pre nás je dôležitý suchý britský gin, po ktorom sa
                chceš rozprávať o poézii.
              </p>
            </div>
            <div className="p-4 bg-gray-900 rounded border border-gray-800 hover:border-emerald-600 transition">
              <h4 className="text-lg text-white font-bold mb-2">Rum</h4>
              <p className="text-sm">
                Tekutý cukor a pirátske báchorky. Biely do Mojít (tvoje
                prekliatie), tmavý pre znalcov s cigarou, ktorí chcú pôsobiť
                nebezpečne.
              </p>
            </div>
            <div className="p-4 bg-gray-900 rounded border border-gray-800 hover:border-emerald-600 transition">
              <h4 className="text-lg text-white font-bold mb-2">
                Tequila & Mezcal
              </h4>
              <p className="text-sm">
                Sponzor najhorších životných rozhodnutí a ranných okien. Ak si
                niekto pýta Mezcal, väčšinou má na sebe flanelku a sekeru v
                batohu.
              </p>
            </div>
            <div className="p-4 bg-gray-900 rounded border border-gray-800 hover:border-emerald-600 transition">
              <h4 className="text-lg text-white font-bold mb-2">
                Whisky / Bourbon
              </h4>
              <p className="text-sm">
                Tekuté drevo pre dospelých. Budú ti básniť o tónoch kože, ale po
                treťom panáku nespoznajú 12-ročný malt od čističa na okná.
              </p>
            </div>
            <div className="p-4 bg-gray-900 rounded border border-gray-800 hover:border-emerald-600 transition">
              <h4 className="text-lg text-white font-bold mb-2">Likéry</h4>
              <p className="text-sm">
                Smrtiaca zmes alkoholu a cukru. Pri práci s nimi budeš mať
                zalepené ruky do konca zmeny. Úplná nočná mora na čistenie.
              </p>
            </div>
            <div className="p-4 bg-gray-900 rounded border border-gray-800 hover:border-emerald-600 transition">
              <h4 className="text-lg text-white font-bold mb-2">Cognac / Brandy</h4>
              <p className="text-sm">
                Destilované víno pre ľudí, ktorí si myslia, že sú lepší ako ty. Pije sa z pohára, ktorý vyzerá ako akvárium pre zlatú rybku, a musíš sa tváriť, že tam cítiš dubový sud, aj keď cítiš len spálené hrdlo.
              </p>
            </div>
          </div>

          <div className="my-8 overflow-hidden rounded-lg border border-gray-800 shadow-lg shadow-black/50">
            <img 
              src={`/images/alcohol_shelf.webp?t=${imageStatus['alcohol_shelf.webp'] === 'saved' ? Date.now() : '1'}`}
              alt="Polička s alkoholom" 
              className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/050505/10b981?text=Generujem...';
              }}
            />
          </div>
        </section>

        {/* PRAVIDLO 4 */}
        <section id="pravidlo-4" className="chapter">
          <h2 className="chapter-title">Pravidlo #4: Anatómia opice</h2>
          <p className="italic text-gray-400 mb-6">
            Základné kategórie drinkov, ktoré ťa budú živiť
          </p>

          <p className="mb-6 text-lg">
            Vyber si svoju jedovatú kategóriu.
          </p>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            <button 
              onClick={() => setActiveCategory('cocktails')}
              className={`px-4 py-2 rounded-full font-bold transition-all ${activeCategory === 'cocktails' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              🍸 Koktejly & Alkohol
            </button>
            <button 
              onClick={() => setActiveCategory('non-alcoholic')}
              className={`px-4 py-2 rounded-full font-bold transition-all ${activeCategory === 'non-alcoholic' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              🥤 Nealko (Nuda)
            </button>
            <button 
              onClick={() => setActiveCategory('hot')}
              className={`px-4 py-2 rounded-full font-bold transition-all ${activeCategory === 'hot' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              ☕ Horúce (Záchrana)
            </button>
          </div>

          <div className="min-h-[400px]">
            {activeCategory === 'cocktails' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <p className="mb-6 text-gray-300 italic">
                  Ak si doteraz delil alkohol na "pivo", "víno" a "to, z čoho mi bolo minule zle", je čas dospieť.
                </p>
                <ul className="space-y-4">
                  <li className="pl-4 border-l-2 border-emerald-600/50 hover:border-emerald-500 transition-colors">
                    <strong className="text-white text-lg">Aperitívy:</strong>{" "}
                    Rozbehová dráha pre profesionálnych aj amatérskych alkoholikov. Sú
                    suchšie, horkejšie a ľahšie. <br />
                    <span className="text-emerald-500 text-sm italic">
                      Príklady z reality: Negroni, Aperol Spritz, Campari Orange.
                    </span>
                  </li>
                  <li className="pl-4 border-l-2 border-emerald-600/50 hover:border-emerald-500 transition-colors">
                    <strong className="text-white text-lg">Digestívy:</strong>{" "}
                    Záchranná brzda. Zákazník práve zožral polovicu prasaťa a myslí
                    si, že bylinný likér spasí jeho trakt.
                    <br />
                    <span className="text-emerald-500 text-sm italic">
                      Príklady z reality: Jägermeister, Fernet, Old Fashioned.
                    </span>
                  </li>
                  <li className="pl-4 border-l-2 border-emerald-600/50 hover:border-emerald-500 transition-colors">
                    <strong className="text-white text-lg">
                      Highballs (Long drinky):
                    </strong>{" "}
                    Tvoj najlepší priateľ počas apokalypsy. Spiritus, ľad, bublinky.
                    Rýchle a opití to milujú.
                    <br />
                    <span className="text-emerald-500 text-sm italic">
                      Príklady z reality: Gin & Tonic, Cuba Libre.
                    </span>
                  </li>
                  <li className="pl-4 border-l-2 border-emerald-600/50 hover:border-emerald-500 transition-colors">
                    <strong className="text-white text-lg">
                      Short Drinks (Krátke drinky):
                    </strong>{" "}
                    Malý objem, veľká sila. Pre ľudí, ktorí nemajú čas piť veľa vody, ale chcú veľa alkoholu. Zvyčajne bez ľadu, podávané v stopke.
                    <br />
                    <span className="text-emerald-500 text-sm italic">
                      Príklady z reality: Martini Dry, Manhattan, Cosmopolitan.
                    </span>
                  </li>
                  <li className="pl-4 border-l-2 border-emerald-600/50 hover:border-emerald-500 transition-colors">
                    <strong className="text-white text-lg">Sours (Kysláče):</strong>{" "}
                    Alfa a omega remesla. Alkohol + citrus + sladidlo. Musia byť
                    presne na hrane medzi sladkým a nepríjemne kyslým.
                    <br />
                    <span className="text-emerald-500 text-sm italic">
                      Príklady z reality: Whiskey Sour, Daiquiri, Margarita.
                    </span>
                  </li>
                  <li className="pl-4 border-l-2 border-emerald-600/50 hover:border-emerald-500 transition-colors">
                    <strong className="text-white text-lg">Flips (Vaječné drinky):</strong>{" "}
                    Alkohol, cukor a celé vajce. Áno, surové vajce. Chutí to ako tekutý koláč a vyzerá to ako... no, proste to musíš poriadne vyšejkovať, inak to bude praženica.
                    <br />
                    <span className="text-emerald-500 text-sm italic">
                      Príklady z reality: Porto Flip, Brandy Flip.
                    </span>
                  </li>
                  <li className="pl-4 border-l-2 border-emerald-600/50 hover:border-emerald-500 transition-colors">
                    <strong className="text-white text-lg">Tiki drinky:</strong>{" "}
                    Tekutý cirkus. Osem druhov rumu, päť sirupov a na vrchu ohňostroj.
                    Zákazník je na Havaji, ty si praješ smrť.
                    <br />
                    <span className="text-emerald-500 text-sm italic">
                      Príklady z reality: Mai Tai, Zombie, Piña Colada.
                    </span>
                  </li>
                </ul>
              </div>
            )}

            {activeCategory === 'non-alcoholic' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <p className="mb-6 text-gray-300 italic">
                  Pre tehotné, šoférov a tých, ktorí si myslia, že sa dá zabaviť aj bez alkoholu (nedá).
                </p>
                <ul className="space-y-4">
                  <li className="pl-4 border-l-2 border-blue-500/50 hover:border-blue-400 transition-colors">
                    <strong className="text-white text-lg">Virgin Cocktails (Nealko koktejly):</strong>{" "}
                    Vyzerá to ako drink, stojí to skoro ako drink, ale chýba tomu pointa. 
                    Najčastejšie len džús so sirupom a mätou.
                    <br />
                    <span className="text-emerald-500 text-sm italic">
                      Príklady: Virgin Mojito, Shirley Temple, Virgin Mary (paradajková polievka v pohári).
                    </span>
                  </li>
                  <li className="pl-4 border-l-2 border-blue-500/50 hover:border-blue-400 transition-colors">
                    <strong className="text-white text-lg">Domáce limonády:</strong>{" "}
                    Zlatá baňa každého podniku. 90% ľad, 5% voda z vodovodu, 5% najlacnejší sirup a plátok citróna.
                    Marža 4000%.
                    <br />
                    <span className="text-emerald-500 text-sm italic">
                      Príklady: "Bazová", "Zázvorová", "Uhorková" (voda s uhorkou).
                    </span>
                  </li>
                  <li className="pl-4 border-l-2 border-blue-500/50 hover:border-blue-400 transition-colors">
                    <strong className="text-white text-lg">Voda (Hydratácia):</strong>{" "}
                    To, čo si ľudia pýtajú o 3:00 ráno, keď si uvedomia, že zajtra musia ísť do práce.
                    Vždy im daj tú z vodovodu, aj keď si pýtajú minerálku. Nebudú si to pamätať.
                  </li>
                </ul>
              </div>
            )}

            {activeCategory === 'hot' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <p className="mb-6 text-gray-300 italic">
                  Keď mrzne, alebo keď potrebuješ skryť alkohol do niečoho, čo vyzerá ako čaj.
                </p>
                <ul className="space-y-4">
                  <li className="pl-4 border-l-2 border-red-500/50 hover:border-red-400 transition-colors">
                    <strong className="text-white text-lg">Grog / Hot Toddy:</strong>{" "}
                    Horúca voda, cukor, citrón a najlacnejší rum/whisky, čo nájdeš. 
                    Oficiálny liek na chrípku, zlomené srdce a hypotermiu.
                  </li>
                  <li className="pl-4 border-l-2 border-red-500/50 hover:border-red-400 transition-colors">
                    <strong className="text-white text-lg">Varené víno (Mulled Wine):</strong>{" "}
                    Geniálny spôsob, ako sa zbaviť vína, ktoré začalo oxidovať. 
                    Prevaríš ho s klinčekmi, škoricou a cukrom. Veľa cukru. Aby necítili tú pachuť.
                  </li>
                  <li className="pl-4 border-l-2 border-red-500/50 hover:border-red-400 transition-colors">
                    <strong className="text-white text-lg">Írska káva:</strong>{" "}
                    Káva, whisky, cukor a smotana. Jediný spoločensky akceptovateľný spôsob, 
                    ako začať piť už o 10:00 ráno. Pozor na smotanu, musí plávať na vrchu, inak to vyzerá ako zvratky.
                  </li>
                  <li className="pl-4 border-l-2 border-red-500/50 hover:border-red-400 transition-colors">
                    <strong className="text-white text-lg">Horúca čokoláda (s "vylepšením"):</strong>{" "}
                    Pre dospelé deti. Čokoláda s rumom alebo Baileys. 
                    Lepidlo na žalúdok, po ktorom sa ťažko behá, ale dobre spí.
                  </li>
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* PRAVIDLO 5 */}
        <section id="pravidlo-5" className="chapter">
          <h2 className="chapter-title">Pravidlo #5: Fyzika pre zúfalcov</h2>
          <p className="italic text-gray-400 mb-6">
            Základné techniky prípravy
          </p>

          <p className="mb-6 text-lg">
            To, že dáš ingrediencie do pohára, z teba barmana nerobí. Vyber zlú
            techniku a zničíš nápoj za dvanásť eur.
          </p>

          <div className="my-8 overflow-hidden rounded-lg border border-gray-700 shadow-lg shadow-black/50">
            <img 
              src={`/images/shaking_fail.webp?t=${imageStatus['shaking_fail.webp'] === 'saved' ? Date.now() : '1'}`}
              alt="Nepodarené šejkovanie" 
              className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1f2937/10b981?text=Generujem...';
              }}
            />
            <p className="text-center text-xs text-gray-500 mt-2 italic">Dôvod, prečo nosíme tmavé oblečenie</p>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="text-xl text-white font-bold inline-block border-b border-emerald-500 mb-2">
                Building (Priama príprava)
              </h4>
              <div className="mb-4 overflow-hidden rounded-lg border border-gray-800 shadow-lg shadow-black/50">
                <img 
                  src={`/images/building_drink.webp?t=${imageStatus['building_drink.webp'] === 'saved' ? Date.now() : '1'}`}
                  alt="Building technika" 
                  className="w-full h-48 object-cover hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/050505/10b981?text=Generujem...';
                  }}
                />
              </div>
              <p className="mb-2">
                Najjednoduchšia vec na svete. Naleješ alkohol, dáš ľad, doleješ
                nealko. Ak pokazíš toto, vráť zásteru a choď vykladať rožky.
              </p>
              <p className="text-sm text-emerald-400 italic">
                Kedy použiť: Highbally, jednoduché mixy (Gin Tonic, Cuba Libre, Vodka Soda). Žiadne šejkovanie, len jemné premiešanie slamkou.
              </p>
            </div>
            <div>
              <h4 className="text-xl text-white font-bold inline-block border-b border-emerald-500 mb-2">
                Stirring (Miešanie)
              </h4>
              <div className="mb-4 overflow-hidden rounded-lg border border-gray-800 shadow-lg shadow-black/50">
                <img 
                  src={`/images/stirring_drink.webp?t=${imageStatus['stirring_drink.webp'] === 'saved' ? Date.now() : '1'}`}
                  alt="Stirring technika" 
                  className="w-full h-48 object-cover hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/050505/10b981?text=Generujem...';
                  }}
                />
              </div>
              <p className="mb-2">
                Tu sa tvárime sofistikovane. Naleješ ingrediencie do miešacieho
                pohára a dlhou lyžičkou ich miešaš. Ľad sa nesmie otĺcť,
                tekutinu len nežne hladíš.{" "}
                <strong>
                  Kto šejkuje Martini (aj keď to hovoril James Bond), patrí do
                  pekla.
                </strong>
              </p>
              <p className="text-sm text-emerald-400 italic">
                Kedy použiť: Drinky zložené LEN z alkoholu (Martini, Manhattan, Negroni, Old Fashioned). Cieľom je vychladiť a zriediť, ale nezakaliť a nenapeniť.
              </p>
            </div>
            <div>
              <h4 className="text-xl text-white font-bold inline-block border-b border-emerald-500 mb-2">
                Shaking (Šejkovanie)
              </h4>
              <p className="mb-2">
                Fyzická drina a tvoj budúci syndróm karpálneho tunela. Hodíš
                všetko do šejkra a trepeš. Máš pri tom vyzerať, že presne vieš,
                čo robíš, nie ako epileptik pri mixéri.
              </p>
              <p className="text-sm text-emerald-400 italic">
                Kedy použiť: Ak drink obsahuje citrusy, smotanu, vajcia alebo sirupy. Potrebuješ spojiť ingrediencie rôznej hustoty a prevzdušniť drink (Whiskey Sour, Daiquiri, Margarita).
              </p>
            </div>
            <div>
              <h4 className="text-xl text-white font-bold inline-block border-b border-emerald-500 mb-2">
                Muddling (Drvenie)
              </h4>
              <div className="mb-4 overflow-hidden rounded-lg border border-gray-800 shadow-lg shadow-black/50">
                <img 
                  src={`/images/muddling_mint.webp?t=${imageStatus['muddling_mint.webp'] === 'saved' ? Date.now() : '1'}`}
                  alt="Muddling technika" 
                  className="w-full h-48 object-cover hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/050505/10b981?text=Generujem...';
                  }}
                />
              </div>
              <p className="mb-2">
                Zoberieš drevený kolík a rozpučíš bylinky na dne. Zlaté
                pravidlo: mätu len jemne poflákaj, ak ju rozdrvíš na kašu, drink
                bude chutiť ako trávnik po kosačke.
              </p>
              <p className="text-sm text-emerald-400 italic">
                Kedy použiť: Caipirinha, Mojito, Old Fashioned (ak drvíš cukor). Vždy v skle, v ktorom sa drink podáva (alebo v šejkri pred šejkovaním).
              </p>
            </div>
          </div>
        </section>

        {/* PRAVIDLO 6 */}
        <section id="pravidlo-6" className="chapter">
          <h2 className="chapter-title">Pravidlo #6: Črepy prinášajú šťastie</h2>
          <p className="italic text-gray-500 mb-6">
            (Alebo výpoveď). Základné druhy skla.
          </p>

          <p className="mb-6 text-lg">
            Každý drink má svoj domov. Ak naleješ Martini do pollitráku, boh barmanov zabije mačiatko.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900 p-5 rounded border-l-4 border-emerald-600">
              <h4 className="text-xl text-white font-bold mb-1">Collins / Highball</h4>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Vysoký valec</p>
              <p className="text-sm text-gray-300">
                Tvoj pracovný kôň. Ide sem všetko, čo má veľa ľadu a nealko zložku. Gin Tonic, Mojito, Paloma. Čím viac ľadu, tým menej nealka musíš doliať (šetríme!).
              </p>
            </div>

            <div className="bg-gray-900 p-5 rounded border-l-4 border-emerald-600">
              <h4 className="text-xl text-white font-bold mb-1">Rocks / Old Fashioned</h4>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Nízky a široký</p>
              <p className="text-sm text-gray-300">
                Pre seriózne pitie. Whisky na ľade, Negroni, Old Fashioned. Ťažké sklo, ktorým sa dobre mláti o stôl, keď chceš zdôrazniť pointu.
              </p>
            </div>

            <div className="bg-gray-900 p-5 rounded border-l-4 border-emerald-600">
              <h4 className="text-xl text-white font-bold mb-1">Coupe / Martini</h4>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Stopka a miska</p>
              <p className="text-sm text-gray-300">
                Najelegantnejšie a najnepraktickejšie sklo. Všetko sa z toho vyleje, kým to donesieš k stolu. Pre drinky bez ľadu (Cosmopolitan, Daiquiri, Martini).
              </p>
            </div>

            <div className="bg-gray-900 p-5 rounded border-l-4 border-emerald-600">
              <h4 className="text-xl text-white font-bold mb-1">Shot glass</h4>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Poldecák</p>
              <p className="text-sm text-gray-300">
                Nástroj skazy. Slúži na rýchly transport alkoholu do krvného obehu bez zbytočného vychutnávania. Tequila, Jäger, B52.
              </p>
            </div>
          </div>
        </section>

        {/* PRAVIDLO 7 */}
        <section id="pravidlo-7" className="chapter">
          <h2 className="chapter-title">Pravidlo #7: Krízový manažment</h2>
          <p className="italic text-gray-500 mb-6">
            Keď ide všetko do... preč.
          </p>

          <div className="space-y-8">
            {/* Difficult Customers */}
            <div>
              <h3 className="text-2xl text-white font-bold mb-4 flex items-center">
                <span className="text-emerald-500 mr-3">🤬</span>
                Zákazník, ktorý má "vždy pravdu"
              </h3>
              <p className="mb-4 text-gray-300">
                Zákazník má pravdu len vtedy, keď platí. V momente, keď začne byť nepríjemný, stáva sa z neho "problém".
              </p>
              <ul className="list-disc pl-5 space-y-2 text-gray-400">
                <li>
                  <strong>Pískanie a lúskanie:</strong> Ignoruj. Totálne. Pozeraj sa cez neho, akoby bol zo skla. Keď sa opýta, či ho vidíš, povedz: <em>"Prepáčte, reagujem len na verbálnu komunikáciu, nie na povely pre psov."</em>
                </li>
                <li>
                  <strong>"To je slabé, nalej viac":</strong> Klasika. Pozri sa mu hlboko do očí a povedz: <em>"Pane, ak chcete dvojitú, rád vám ju naúčtujem. Ak chcete charitu, kostol je o dve ulice ďalej."</em>
                </li>
                <li>
                  <strong>Agresor:</strong> Udržuj očný kontakt, neusmievaj sa, hovor ticho a pomaly. Ticho znervózňuje opitých ľudí viac ako krik. A maj ruku blízko "panic button" (alebo aspoň ťažkého popola).
                </li>
              </ul>
            </div>

            {/* Spills */}
            <div>
              <h3 className="text-2xl text-white font-bold mb-4 flex items-center">
                <span className="text-emerald-500 mr-3">🌊</span>
                Potopa sveta (Rozliate drinky)
              </h3>
              <p className="mb-4 text-gray-300">
                Rozleješ to. Stane sa to. Otázka nie je "či", ale "kedy" a "na koho".
              </p>
              <div className="bg-gray-900 p-4 rounded border-l-4 border-red-600">
                <strong className="text-white block mb-2">Postup pri katastrofe:</strong>
                <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-400">
                  <li><strong>Nezamrzni:</strong> Ak stojíš a pozeráš na tú mláku, vyzeráš ako amatér.</li>
                  <li><strong>Hoď na to handru:</strong> Okamžite. Aj keď je to na zákazníkovi (možno sa opýtaj najprv).</li>
                  <li><strong>Ospravedlň sa (raz):</strong> "Moja chyba, hneď to napravím." Neplaz sa. Sme ľudia, nie rohožky.</li>
                  <li><strong>Nalej nový drink:</strong> Na účet podniku. Rýchlo. Alkohol je najlepšie lepidlo na pošramotené ego zákazníka.</li>
                </ol>
              </div>
            </div>

            {/* Inventory */}
            <div>
              <h3 className="text-2xl text-white font-bold mb-4 flex items-center">
                <span className="text-emerald-500 mr-3">📦</span>
                Inventúra (Matematika v 3:00 ráno)
              </h3>
              <p className="mb-4 text-gray-300">
                Najhoršia časť práce. Počítanie fľašiek, keď vidíš dvojmo.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-gray-400">
                <li>
                  <strong>Pravidlo desatiny:</strong> Vždy ti bude chýbať 0.04l. Je to daň barovým škriatkom (alebo tvojmu kolegovi, čo si "odpil na koštovku").
                </li>
                <li>
                  <strong>Váženie fliaš:</strong> Ak máš váhu, používaj ju. Odhad "od oka" je dôvod, prečo máš manko.
                </li>
                <li>
                  <strong>FIFO (First In, First Out):</strong> Staré veci dopredu. Nikto nechce piť mlieko do kávy, ktoré pamätá minulú vládu.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="chapter">
          <h2 className="chapter-title">FAQ: Časté otázky</h2>
          <p className="italic text-gray-500 mb-6">
            (A hlúpe odpovede)
          </p>

          <div className="space-y-6">
            <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
              <h4 className="text-lg text-emerald-500 font-bold mb-2">
                "Ako sa najlepšie naučím mixológiu?"
              </h4>
              <p className="text-gray-300">
                Nepoužívaj slovo mixológ. Si barman. Miešaš alkohol s cukrom. Ak chceš byť mixológ, kúp si pinzetu na bylinky a priprav sa, že ťa budú kolegovia ohovárať. Najlepšia škola je robiť zadarmo v dobrom bare a umývaj poháre pol roka, kým ti dovolia dotknúť sa fľaše.
              </p>
            </div>

            <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
              <h4 className="text-lg text-emerald-500 font-bold mb-2">
                "Čo robiť, keď je v bare mŕtvo (slow night)?"
              </h4>
              <p className="text-gray-300">
                Leštiť. Všetko. Aj to, čo sa neleskne. Alebo preklínať počasie. Čas na "lean time" - opri sa, pozeraj do blba a modli sa, aby neprišiel autobus s rozlúčkou so slobodou 5 minút pred záverečnou.
              </p>
            </div>

            <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
              <h4 className="text-lg text-emerald-500 font-bold mb-2">
                "Môžem piť v práci?"
              </h4>
              <p className="text-gray-300">
                Oficiálne: Nie. Neoficiálne: Slamkový test je tvoj najlepší kamarát. Ale pamätaj: ak odpadneš skôr ako zákazník, prehral si hru.
              </p>
            </div>

            <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
              <h4 className="text-lg text-emerald-500 font-bold mb-2">
                "Ako zbalím barmanku/barmana?"
              </h4>
              <p className="text-gray-300">
                Nijako. Sme v práci, smrdíme po zvetranom pive, bolia nás nohy a v duchu ťa nenávidíme, lebo nás zdržuješ. Nechaj tringelt a choď domov. To je najväčší prejav lásky.
              </p>
            </div>
          </div>
        </section>

        {/* SLOVNÍK */}
        <section id="slovnik" className="chapter bg-[#0a0a0a] rounded-xl my-8 px-8 py-10 shadow-2xl border border-gray-800">
          <h2 className="chapter-title border-none text-center">
            Slovník bolesti
          </h2>
          <p className="text-center italic text-gray-500 mb-10">
            Barmanská terminológia preložená do reality
          </p>

          <div className="term-card">
            <h4 className="text-2xl text-emerald-500 font-bold mb-2">Muddler</h4>
            <p className="text-gray-300 text-sm mb-2">
              <span className="bg-gray-900 px-2 py-1 rounded text-xs border border-gray-800">
                Definícia:
              </span>{" "}
              Nástroj slúžiaci na drvenie ovocia a byliniek.
            </p>
            <p className="text-white">
              <span className="text-red-500 font-bold">Cynický preklad:</span>{" "}
              Kolík, ktorým drvíš mätu do nekonečných Mojít a spolu s ňou aj
              svoje sny o tom, že dnes odídeš z práce načas.
            </p>
          </div>

          <div className="term-card">
            <h4 className="text-2xl text-emerald-500 font-bold mb-2">Jigger</h4>
            <p className="text-gray-300 text-sm mb-2">
              <span className="bg-gray-900 px-2 py-1 rounded text-xs border border-gray-800">
                Definícia:
              </span>{" "}
              Obojstranná odmerka pre presné dávkovanie.
            </p>
            <p className="text-white">
              <span className="text-red-500 font-bold">Cynický preklad:</span>{" "}
              Tá malá blbosť, ktorú ti vedenie vnútilo, aby si nedával kamarátom
              dvojité porcie zadarmo.
            </p>
          </div>

          <div className="term-card">
            <h4 className="text-2xl text-emerald-500 font-bold mb-2">On the rocks</h4>
            <p className="text-gray-300 text-sm mb-2">
              <span className="bg-gray-900 px-2 py-1 rounded text-xs border border-gray-800">
                Definícia:
              </span>{" "}
              Nápoj podávaný v nízkom pohári na kockách ľadu.
            </p>
            <p className="text-white">
              <span className="text-red-500 font-bold">Cynický preklad:</span>{" "}
              Presne to, čo sa stane s tvojím osobným a romantickým životom po
              pol roku nočných zmien.
            </p>
          </div>

          <div className="term-card">
            <h4 className="text-2xl text-emerald-500 font-bold mb-2">
              Záverečná (Last Call)
            </h4>
            <p className="text-gray-300 text-sm mb-2">
              <span className="bg-gray-900 px-2 py-1 rounded text-xs border border-gray-800">
                Definícia:
              </span>{" "}
              Čas, kedy bar prijíma posledné objednávky.
            </p>
            <p className="text-white">
              <span className="text-red-500 font-bold">Cynický preklad:</span>{" "}
              Mytologický koncept. Vždy sa nájde polomŕtvy intelektuál, ktorý ťa
              presviedča, že "jeden rýchly panák" ešte nikdy nikoho nezabil.
              (Zabil. Mňa. Zvnútra).
            </p>
          </div>

          <div className="term-card">
            <h4 className="text-2xl text-emerald-500 font-bold mb-2">Mojito</h4>
            <p className="text-gray-300 text-sm mb-2">
              <span className="bg-gray-900 px-2 py-1 rounded text-xs border border-gray-800">
                Definícia:
              </span>{" "}
              Tradičný kubánsky highball z bieleho rumu.
            </p>
            <p className="text-white">
              <span className="text-red-500 font-bold">Cynický preklad:</span>{" "}
              Zelený, listnatý močiar zúfalstva. Objednávka, pri ktorej si
              praješ, aby do podniku udrel blesk.
            </p>
          </div>

          <div className="my-8 overflow-hidden rounded-lg border border-gray-700 shadow-lg shadow-black/50">
            <img 
              src={`/images/tears.webp?t=${imageStatus['tears.webp'] === 'saved' ? Date.now() : '1'}`}
              alt="Slzy barmana" 
              className="w-full h-auto object-cover opacity-70 hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1f2937/10b981?text=Generujem...';
              }}
            />
          </div>
        </section>

        {/* TIPY A TRIKY */}
        <section id="tipy-a-triky" className="chapter">
          <h2 className="chapter-title">Tipy a Triky</h2>
          <p className="italic text-gray-500 mb-6">
            Pre tých, ktorí chcú vedieť viac ako len naliať pivo
          </p>
          
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 mb-8">
            <p className="text-gray-300 mb-4 text-lg">
              Barmanstvo nie je len o tom, že vieš otvoriť fľašu a naliať do pohára. Je to remeslo, ktoré si vyžaduje neustále učenie, experimentovanie a zdokonaľovanie techniky.
              Každý deň sa objavujú nové trendy, nové ingrediencie a nové spôsoby, ako ohúriť (alebo otráviť) zákazníka.
            </p>
            <p className="text-gray-300 mb-4">
              Ak chceš posunúť svoje schopnosti na vyššiu úroveň, prestaň sa spoliehať na náhodu a začni študovať.
              Skutočný majster vie, prečo sa ľad topí tak, ako sa topí, a prečo sa niektoré chute k sebe hodia a iné nie.
            </p>
          </div>

          <div className="bg-emerald-900/20 p-6 rounded-lg border border-emerald-800/50 text-center">
            <h4 className="text-xl text-emerald-400 font-bold mb-4">Chceš vedieť viac?</h4>
            <p className="text-gray-300 mb-6">
              Pre pokročilé techniky, videonávody a hlbší ponor do sveta mixológie (fuj, to slovo), odporúčame tento zdroj:
            </p>
            <a 
              href="https://www.diffordsguide.com/encyclopedia" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-full transition-all transform hover:scale-105 shadow-lg hover:shadow-emerald-500/20"
            >
              Difford's Guide - Encyklopédia
            </a>
            <p className="text-xs text-gray-500 mt-4 italic">
              (Áno, je to po anglicky. Ak nevieš po anglicky, nauč sa. Barman bez angličtiny je ako ryba bez bicykla... počkať, to nedáva zmysel. Proste sa to nauč.)
            </p>
          </div>
        </section>

        {/* ZÁVER */}
        <section id="zaver" className="chapter border-none text-center pb-20">
          <h2 className="chapter-title border-none">Záver</h2>
          <p className="text-xl mb-8">
            Ak si to dočítal až sem a stále chceš byť barmanom, gratulujem. Si
            oficiálne masochista.
          </p>
          <p className="text-lg text-gray-400">
            Ale vážne. Je to najlepšia práca na svete. Len to nikomu nehovor,
            lebo nám sem nabehnú všetci.
          </p>
          <div className="mt-12 text-emerald-500 text-4xl">🍸</div>
        </section>
      </main>
    </div>
  );
}
