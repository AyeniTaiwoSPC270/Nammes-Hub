 Build a 2 to 3 minute motion graphics explainer video for NAMMES Hub using Remotion (free,             
React-based). Work                                                                                             
  in a new folder, video/, at the project root, so it doesn't touch the site. Don't commit anything until I've 
  watched a preview.                                                                                           
                                                                                                               
  1. What NAMMES Hub is                                                                                        
  It is the website of the National Association of Metallurgical and Materials Engineering Students,           
University                                                                                                     
  of Lagos Chapter (nammeshub.com.ng). It is one place for outlines, timetable, CGPA calculator, resources,    
  events, news, opportunities, awards, forms and live quizzes.                                                 
                                                                                                               
  2. Audience and tone                                                                                         
  - The audience is UNILAG students, from 100 Level freshers to final years.                                   
  - The tone is fun and full of Nigerian campus energy. It should be playful and fast-cut with bouncy motion.  
  - Light campus slang is fine, like "no more wahala" and "e don set". Keep it clean and don't overdo it.      
  - Never claim anything the Hub doesn't do.                                                                   
                                                                                                               
  3. Formats                                                                                                   
  - Build two compositions from one codebase: Explainer169 (1920×1080) and Explainer916 (1080×1920), both at   
30                                                                                                             
    fps.                                                                                                       
  - Share all scene components. Use a layout prop or responsive sizing so the same scenes reflow for each      
    format.                                                                                                    
  - In 9:16, keep text inside the safe zone. Leave about 250 px clear at the bottom and 150 px at the top.     
  - Target length is about 2:30. Put each scene's duration in a constants file so I can tweak timing easily.   
                                                                                                               
  4. Brand (use exactly these)                                                                                 
  - Colours:                                                                                                   
    - Green: #04160c (950), #0b2417 (900), #0c4a24 (800), #145c30 (700), #e6f0ea (100 tint)                    
    - Orange: #ff5a1f (main), #ae3200 (dark), #fff0e6 (tint)                                                   
    - Gold: #f4c430                                                                                            
    - Paper: #fcf9f8                                                                                           
    - Ink: #1c1b1b                                                                                             
  - Fonts: Playfair Display for headlines and Public Sans for body and captions. Load them with                
    @remotion/google-fonts.                                                                                    
  - Logo: public/logo.png and public/logo-small.png. Copy them into video/public/.                             
  - Backgrounds: dark green for hero scenes and paper for feature scenes. Use orange as the accent and gold    
for                                                                                                            
    celebrations and podium moments.                                                                           
  - Style: flat and clean, in the same family as the site's flat illustrations. Use rounded cards, soft        
    shadows, and device frames (a phone and a browser window) around the screenshots.                          
                                                                                                               
  5. Assets to use                                                                                             
  - Real screenshots are already in scripts/manual/screens/: home, outlines, outlines-courses, outline-detail, 
    timetable, cgpa, resources, events, news, opportunities, awards, forms, form-detail, excos, contact, and   
    the phone shots m-home, m-menu and m-outlines. Copy what you need into video/public/.                      
  - There are no quiz screenshots. Draw the quiz scenes as animated UI in React/SVG, because they can't be     
    captured from a live game. The 50 animated characters are in src/components/quiz/Character.jsx and         
    src/data/quizCharacters.js. Reuse or port a handful of them for the quiz scenes if that is practical. If   
it                                                                                                             
    isn't, draw simple, charming stand-in characters.                                                          
  - Don't use real student names, matric numbers or photos. Use "Player 1" or playful nicknames like Ada_Bolt  
    and MMEKing for any quiz UI.                                                                               
                                                                                                               
  6. Audio                                                                                                     
  - Don't generate audio. Leave the voiceover and music for me to add.                                         
  - Export a timed captions file (captions.srt) and show burned-in captions in the video, so it works muted on 
    WhatsApp and Reels. Make captions bold, high-contrast and two lines at most.                               
  - Add a voiceover-script.md with the narration split by scene and a duration for each, so I can record it or 
    feed it to a free text-to-speech voice.                                                                    
  - Leave a music bed slot in the project (public/music.mp3, optional). If that file exists, play it at low    
    volume and duck it under narration. If it doesn't exist, render silently without errors.                   
  - Sound effects are optional. Put in whoosh and pop slots only if I supply files.                            
                                                                                                               
  7. Scene-by-scene storyboard                                                                                 
  Write the voiceover in the same fun tone. Use motion like text that springs in, cards that slide and stack,  
  cursor taps, and screens that zoom from a phone frame into a browser frame.                                  
                                                                                                               
  1. Cold open (0:00–0:10). Quick cuts of student problems: a chat full of "who has the outline?", a blurry    
     photo of a timetable, a missed deadline. Screen-shake and stamp-in text: "Where is the outline? When is   
     the exam?". The logo then slams in: NAMMES Hub. Everything, one address.                                  
  2. Meet the Hub (0:10–0:25). The home page scrolls. The menu bar grows into a map of the site: Academics,    
     Community, Forms, Contact. The voiceover says you don't need an account to browse, and sign-up takes a    
     minute.                                                                                                   
  3. Academics (0:25–1:00).                                                                                    
     - Outlines: level, then semester, then course. Show the course list and highlight the new C / E status    
       badges (C = compulsory, E = elective).                                                                  
     - Show the outline page, with topics, recommended texts and past questions.                               
     - Curriculum: the official CCMAS document.                                                                
     - Timetable: class and exam schedules.                                                                    
     - CGPA calculator: grades go in, numbers count up, and a "download report" tap follows.                   
     - Resources: shared folders.                                                                              
  4. Community (1:00–1:25). Events with a photo gallery, news, and opportunities with a deadline countdown.    
     Then the Awards: the five stage tracker (Nominating, Curating, Voting, Closed, Revealed), a ballot being  
     submitted with "one vote per student", and a winner card. After that, Forms: a form fills in, then a QR   
     code scans.                                                                                               
  5. Live quiz showpiece (1:25–2:05). Make this the most energetic scene.                                      
     - Projector lobby with a six-digit code and a QR code. Phones scan it and players pop into the lobby one  
       by one, each with a character. Captions say "50 characters, pick your fighter".                         
     - A question appears with a countdown. Phone answer buttons are tapped. The reveal shows bars rising and  
a                                                                                                              
       leaderboard with rows sliding into place.                                                               
     - Quick icons for teams, streak flame (+200), double points, 50/50 and power-ups.                         
     - Battles: a split-screen duel with two scores, then a knockout bracket filling in, then a champion on a  
       podium with gold confetti. Add a "Challenge a friend" link being shared as a chat bubble.               
     - Text: "No account. Just a nickname."                                                                    
  6. Behind the scenes (2:05–2:20). The executives' side: an admin dashboard grid of tiles. Show news being    
     published, a form being designed, an awards season moving through stages, and a live quiz being hosted.   
     The caption says the excos run it all.                                                                    
  7. Meet the excos and close (2:20–2:35). The excos page (excos.jpg), then "Built by students, for students". 
     End card: logo, nammeshub.com.ng, "Download the Handbook in the footer", and the social handles if they   
     are in the site footer. Fade out on dark green.                                                           
                                                                                                               
  Keep the screenshots readable for at least 1.5 seconds each. Don't cram more than one idea per scene beat.   
                                                                                                               
  8. Hard rules                                                                                                
  - Don't promise anything beyond what the site does. For example, don't say the quiz is "cheat-proof", and    
    don't say the Hub guarantees anything.                                                                     
  - The awards are for members with a department matric number. Say "members" and not "everyone".              
  - Keep the on-screen text short and accurate. Use exact feature names: Live quiz, Quiz battles, Awards,      
    Forms.                                                                                                     
  - Don't invent statistics or testimonials.                                                                   
                                                                                                               
  9. Deliverables                                                                                              
  - The Remotion project in video/.                                                                            
  - npm run preview for the Remotion Studio.                                                                   
  - Render scripts: npm run render:169 and npm run render:916, which write MP4s to video/out/.                 
  - captions.srt and voiceover-script.md.                                                                      
  - A short video/README.md explaining how to edit the text, timings and screenshots, and where to drop in the 
    music and voiceover.                                                                                       
  - Once the project builds, start Remotion Studio and show me a still frame from each scene in both formats   
    before doing the full render. Fix any text overflow or clipping you find.   