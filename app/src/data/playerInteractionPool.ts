/** Player interaction event pool — TR and EN dialogue/options. */

export type InteractionTrigger =
  | 'benchedAndWon'
  | 'benchedAndLost'
  | 'benchedThreeMatches'
  | 'captainPoorMatch'
  | 'youngPlayerFirstCap'
  | 'threeMatchLosingStreak'
  | 'starPlayerGoodForm'

export interface InteractionChoice {
  text: { tr: string; en: string }
  effect: {
    morale?: number
    relationship?: number
    teamMorale?: number
    mustStartNext?: boolean
    discipline?: number
  }
}

export interface PlayerInteraction {
  dialogue: { tr: string; en: string }
  options: InteractionChoice[]
}

/** Replace [PLAYER] with actual player name at render time. */
export const PLAYER_INTERACTION_POOL: Record<InteractionTrigger, PlayerInteraction[]> = {
  benchedAndWon: [
    {
      dialogue: {
        tr: '[PLAYER] soyunma odasında köşeye çekiyor seni: "Hoca, kazandık tamam da... ben ne zaman oynayacağım yani?"',
        en: '[PLAYER] pulls you aside in the dressing room: "Boss, we won, great — but when is it my turn to play?"',
      },
      options: [
        { text: { tr: 'Anlayışla karşıla, planını anlat', en: 'Hear him out and explain your plan' }, effect: { morale: 2, relationship: 1 } },
        { text: { tr: 'Sert ol, rekabeti hatırlat', en: 'Be firm — remind him competition is healthy' }, effect: { morale: -3, relationship: -2, discipline: 1 } },
        { text: { tr: 'Söz ver: bir sonraki maçta başlıyorsun', en: "Promise him: you'll start the next match" }, effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] soyunma odasından çıkarken duraksıyor: "Hoca, ben hazırım. Sadece bir şans istiyorum."',
        en: '[PLAYER] pauses on his way out: "Boss, I\'m ready. I just need one chance."',
      },
      options: [
        { text: { tr: 'Planını açıkla, sabrını takdir et', en: 'Explain your plan and thank him for his patience' }, effect: { morale: 1, relationship: 1 } },
        { text: { tr: '"Performansın yeterli değil şu an"', en: '"Your performances haven\'t earned a spot yet"' }, effect: { morale: -4, relationship: -3 } },
        { text: { tr: 'Gelecek maçta oynayacaksın, söz', en: "You'll play next match — I promise" }, effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] gülümsemeye çalışıyor ama yüzü her şeyi ele veriyor: "Güzel galibiyet... Keşke ben de sahadaydım."',
        en: '[PLAYER] forces a smile but his eyes give it away: "Great win, boss... I just wish I\'d been out there."',
      },
      options: [
        { text: { tr: 'Takım başarısı her şeyden önemli', en: 'The team result is what matters most' }, effect: { morale: 1, relationship: 0 } },
        { text: { tr: 'Anlıyorum, sıran yakında gelecek', en: 'I understand — your time is coming soon' }, effect: { morale: 2, relationship: 1 } },
        { text: { tr: 'Söz veriyorum, bir sonraki maç senin', en: "I promise — the next match is yours" }, effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] yanına geliyor: "Hoca, bir şey sormak istiyorum. Neden beni oynatmıyorsunuz?"',
        en: '[PLAYER] approaches you directly: "Boss, I need to ask — why am I not playing?"',
      },
      options: [
        { text: { tr: 'Sakin bir şekilde açıkla', en: 'Calmly walk him through your reasoning' }, effect: { morale: 2, relationship: 1 } },
        { text: { tr: '"Önce antrenmanlarda fark yarat"', en: '"Prove yourself in training first"' }, effect: { morale: -2, relationship: -1 } },
        { text: { tr: 'Bir sonraki maçta başlatacağım', en: "I'll start you next match" }, effect: { mustStartNext: true, relationship: 3 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] duştan çıkarken: "Hoca, tribünden izlemek çok zor ya. Gerçekten oynamak istiyorum."',
        en: '[PLAYER] steps out of the shower: "Boss, watching from the stands is killing me. I really want to play."',
      },
      options: [
        { text: { tr: 'Sabret, zamanın gelecek', en: 'Be patient — your time will come' }, effect: { morale: 2, relationship: 1 } },
        { text: { tr: '"Herkes bekliyor, sen de bekleyeceksin"', en: '"Everyone waits their turn — so do you"' }, effect: { morale: -2, relationship: -2 } },
        { text: { tr: 'Söz ver, gelecek maçta oynarsın', en: 'Promise him a start next game' }, effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] antrenman çantasını bırakırken: "Kazanıyoruz ama... ben ne işe yarıyorum ki?"',
        en: '[PLAYER] drops his training bag: "We\'re winning, but... what am I even here for?"',
      },
      options: [
        { text: { tr: 'Takımdaki değerini anlat', en: 'Spell out how much the squad needs him' }, effect: { morale: 3, relationship: 2 } },
        { text: { tr: '"Rekabet var, kabul etmek zorundasın"', en: '"There\'s competition for places — that\'s football"' }, effect: { morale: 0, relationship: 0 } },
        { text: { tr: 'Gelecek maçta başlayacaksın, söz', en: "You'll start next match — I promise" }, effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sana doğrudan bakıyor: "Hoca, açık soruyorum: bana güveniyor musunuz?"',
        en: '[PLAYER] looks you straight in the eye: "Boss, straight question — do you trust me?"',
      },
      options: [
        { text: { tr: '"Evet, planında varsın"', en: '"Yes — you\'re in my plans"' }, effect: { morale: 4, relationship: 2 } },
        { text: { tr: '"Güven sahada kazanılır"', en: '"Trust is earned on the pitch"' }, effect: { morale: -1, relationship: -1 } },
        { text: { tr: 'Gelecek maçta başlatacağım, söz', en: "I'll start you next game — promise" }, effect: { mustStartNext: true, relationship: 3 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] takım kutlamasına katılmıyor, kenarda tek başına oturuyor. Yanına gittiğinde: "Özür dilerim hoca, moralim biraz düşük."',
        en: "[PLAYER] sits alone while everyone else celebrates. When you go over: \"Sorry, boss. I'm just not feeling it right now.\"",
      },
      options: [
        { text: { tr: 'Omzuna vur ve destek ver', en: 'Put a hand on his shoulder and lift him up' }, effect: { morale: 4, relationship: 3 } },
        { text: { tr: '"Takımla kutla, bu davranış doğru değil"', en: '"Go celebrate with the team — this behaviour isn\'t right"' }, effect: { morale: -1, relationship: -1 } },
        { text: { tr: 'Söz ver: bir sonraki maçta sahadasın', en: 'Promise him a start next match' }, effect: { mustStartNext: true, relationship: 3 } },
      ],
    },
  ],

  benchedAndLost: [
    {
      dialogue: {
        tr: '[PLAYER] soyunma odasında seni köşeye çekiyor: "Hoca... Sahadaydım belki fark yaratabilirdim. Bunu düşündünüz mü?"',
        en: '[PLAYER] corners you in the dressing room: "Boss... maybe I could have made a difference out there. Did you think about that?"',
      },
      options: [
        { text: { tr: 'Haklısın, bir sonraki maçta başlıyorsun', en: "You have a point — you'll start next match" }, effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: { tr: '"Kararlarıma güvenmenizi istiyorum"', en: '"I need you to trust my decisions"' }, effect: { morale: -2, relationship: -1 } },
        { text: { tr: '"Bu tutum kabul edilemez, konuşmayacağım"', en: '"That attitude is unacceptable — this conversation is over"' }, effect: { morale: -5, relationship: -3, discipline: 2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] öfkeli ama kendini tutmaya çalışıyor: "Hoca, kaybettik. Ve ben hiç oynamadım. Bu mantıklı mı?"',
        en: '[PLAYER] is furious but holding it together: "Boss, we lost. And I didn\'t play a single minute. Does that make sense?"',
      },
      options: [
        { text: { tr: 'Sakin ol, açıklayayım', en: 'Stay calm — let me explain' }, effect: { morale: 1, relationship: 0 } },
        { text: { tr: 'Bir sonraki maçta kendin kanıtla', en: 'Prove yourself next match' }, effect: { mustStartNext: true, relationship: 1 } },
        { text: { tr: '"Bu tutum seni daha uzun yedekte tutar"', en: '"That attitude will keep you on the bench even longer"' }, effect: { morale: -4, relationship: -4, discipline: 2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] gözleri dolmuş: "Hoca, üzüldüm. Hem kaybettik hem de hiç katkı sunamadım."',
        en: "[PLAYER]'s eyes are welling up: \"Boss, I'm gutted. We lost and I couldn't contribute at all.\"",
      },
      options: [
        { text: { tr: 'Yanında dur ve destekle', en: 'Stand by him and offer your support' }, effect: { morale: 3, relationship: 2 } },
        { text: { tr: 'Bir sonraki maçta oynarsın, söz', en: "You'll play next match — I promise" }, effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: { tr: '"Takım işi bu, hepimiz katıldık"', en: '"Football is a team game — we all contributed"' }, effect: { morale: 0, relationship: 0 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sana yaklaşıyor: "Hoca, bir konuşabilir miyiz? Neden ben oynamıyorum, üstelik kaybettik."',
        en: '[PLAYER] approaches you: "Boss, can we talk? I\'m not playing, and on top of that we\'ve just lost."',
      },
      options: [
        { text: { tr: 'Kapsamlı bir konuşma yap', en: 'Sit down and have a proper conversation' }, effect: { morale: 3, relationship: 3 } },
        { text: { tr: '"Taktik karar, daha fazla açıklayamam"', en: '"It\'s a tactical call — I can\'t say more than that"' }, effect: { morale: 0, relationship: 0 } },
        { text: { tr: '"Şu an uygun değil, yarın konuşuruz"', en: '"Now isn\'t the right time — let\'s talk tomorrow"' }, effect: { morale: -3, relationship: -2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] dolap başında oturup kimseyi dinlemiyor: "Bu yenilgi gereksizdi. Ben oynasaydım..."',
        en: '[PLAYER] sits alone by his locker, not listening to anyone: "This defeat was unnecessary. If I\'d played..."',
      },
      options: [
        { text: { tr: '"Bir takımız, bu lafı kapat"', en: '"We\'re a team — close that line of thinking"' }, effect: { morale: -2, discipline: 2, relationship: -2 } },
        { text: { tr: 'Gelecek maçta oynayacaksın', en: "You'll play next match" }, effect: { mustStartNext: true, relationship: 2, morale: 2 } },
        { text: { tr: 'Baş başa bir konuşalım', en: 'Let\'s find somewhere quiet and talk' }, effect: { morale: 2, relationship: 2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] soyunma odasından çıkarken: "Hoca, bir dahakine beni oynatsanız iyi olur."',
        en: '[PLAYER] on his way out: "Boss, you should really play me next time."',
      },
      options: [
        { text: { tr: 'Söz veriyorum', en: "You have my word" }, effect: { mustStartNext: true, relationship: 2, morale: 2 } },
        { text: { tr: '"Rekabet normal, sıran gelecek"', en: '"Competition is normal — your turn will come"' }, effect: { morale: 0, relationship: 0 } },
        { text: { tr: '"Böyle talep edilmez"', en: '"You don\'t get to demand that"' }, effect: { morale: -3, relationship: -3, discipline: 2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sakin ama kararlı: "Hoca, yedekte oturarak kaybetmek ikiye katlanıyor. Bir şans bekliyorum."',
        en: '[PLAYER] is calm but resolute: "Boss, losing from the bench makes it twice as hard to take. I expect a chance."',
      },
      options: [
        { text: { tr: 'Anlıyorum, bir sonraki maç senin', en: 'I hear you — the next match is yours' }, effect: { morale: 4, relationship: 3, mustStartNext: true } },
        { text: { tr: '"Sabırlı ol, zamanın gelecek"', en: '"Be patient — your time will come"' }, effect: { morale: 1, relationship: 0 } },
        { text: { tr: '"Şansını antrenmanda kazan"', en: '"Earn your chance in training"' }, effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sessizce yanına gelip oturuyor: "Hoca... bu böyle olmak zorunda mıydı?"',
        en: '[PLAYER] quietly sits down beside you: "Boss... did it have to be this way?"',
      },
      options: [
        { text: { tr: 'Açıkla ve gelecek maç için söz ver', en: 'Explain yourself and promise him the next match' }, effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: { tr: '"Evet, bugünkü en iyi karardı"', en: '"Yes — it was the best call today"' }, effect: { morale: -1, relationship: -1 } },
        { text: { tr: '"Biraz dinlen, yarın konuşuruz"', en: '"Get some rest — we\'ll talk tomorrow"' }, effect: { morale: 1, relationship: 1 } },
      ],
    },
  ],

  benchedThreeMatches: [
    {
      dialogue: {
        tr: '[PLAYER] artık sabredemez: "Hoca, üç maçtır oturmaktan bıktım. Bana güvenmiyorsanız söyleyin, kulübüme döneceğim."',
        en: "[PLAYER] has had enough: \"Boss, I'm done sitting for three matches. If you don't trust me, just say so and I'll go back to my club.\"",
      },
      options: [
        { text: { tr: '"Planında yerin var, biraz daha sabret"', en: '"You\'re in my plans — just hold on a little longer"' }, effect: { morale: 1, relationship: 1 } },
        { text: { tr: '"Rekabet var, bu normal futbol"', en: '"There\'s competition for places — that\'s normal"' }, effect: { morale: -2, relationship: -2 } },
        { text: { tr: 'Söz veriyorum, gelecek maçta oynarsın', en: "I promise — you'll play next match" }, effect: { mustStartNext: true, relationship: 3, morale: 3 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] menajerine mesaj attığını ima ediyor: "Üç maçtır yedekteyim. Bir çözüm gerekiyor."',
        en: '[PLAYER] hints he\'s been in touch with his agent: "Three matches on the bench. Something needs to change."',
      },
      options: [
        { text: { tr: 'Planını açıkla ve oynayacağına söz ver', en: 'Lay out your plan and promise him game time' }, effect: { mustStartNext: true, relationship: 2, morale: 2 } },
        { text: { tr: '"Takım kararlarına saygı göster"', en: '"Respect the decisions made for the squad"' }, effect: { morale: -1, relationship: -1 } },
        { text: { tr: '"Bu yol seni daha kötü yere götürür"', en: '"That path will only make things worse for you"' }, effect: { morale: -4, relationship: -4, discipline: 3 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] direkt söylüyor: "Hoca, üç maçtır oturmak yeter. Ya beni oynatsanız ya da açıkça konuşalım."',
        en: '[PLAYER] is direct: "Boss, three matches is enough. Either play me or let\'s have an honest conversation."',
      },
      options: [
        { text: { tr: 'Bir sonraki maçta başlıyorsun, söz', en: "You'll start next match — I promise" }, effect: { mustStartNext: true, relationship: 2, morale: 2 } },
        { text: { tr: '"Kararlarım değişmez"', en: '"My decisions don\'t change"' }, effect: { morale: -3, relationship: -2 } },
        { text: { tr: '"Bu tavır ceza gerektirir"', en: '"That attitude warrants a disciplinary response"' }, effect: { morale: -5, relationship: -5, discipline: 4 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] gözleri üzgün: "Hoca, üç maçtır tribünden seyrediyorum. Bir fırsat verin, hayal kırıklığı yaratmam."',
        en: '[PLAYER] looks hurt: "Boss, I\'ve watched from the stands for three matches. Give me a chance and I won\'t let you down."',
      },
      options: [
        { text: { tr: 'Yanında dur ve söz ver', en: 'Back him up and make a promise' }, effect: { morale: 4, relationship: 3, mustStartNext: true } },
        { text: { tr: '"Sıran gelecek, sabret"', en: '"Your turn will come — be patient"' }, effect: { morale: 1, relationship: 0 } },
        { text: { tr: '"Önce antrenmanda fark yarat"', en: '"Stand out in training first"' }, effect: { morale: -2, relationship: -2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] takım arkadaşlarına şikayetini duyurmuş. Herkes konuşuyor: "Hiçbir açıklama yok."',
        en: "[PLAYER] has been venting to teammates. The whole squad is talking: \"There's no explanation.\"",
      },
      options: [
        { text: { tr: 'Özel konuşma yap ve oynayacağına söz ver', en: 'Pull him aside privately and promise him game time' }, effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: { tr: '"Şikayetini soyunma odasına taşıma"', en: '"Don\'t bring your complaints into the dressing room"' }, effect: { morale: -3, relationship: -3, discipline: 2 } },
        { text: { tr: '"Bir daha olursa resmi uyarı yazarım"', en: '"Next time this happens you get a formal warning"' }, effect: { morale: -5, relationship: -5, discipline: 5 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sana bakıyor: "Hoca, dürüst ol benimle. Planımda gerçekten var mıyım?"',
        en: '[PLAYER] looks at you steadily: "Boss, be straight with me. Am I actually in your plans?"',
      },
      options: [
        { text: { tr: '"Evet varsın. Ve gelecek maç senidir"', en: '"Yes, you are. And the next match is yours"' }, effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: { tr: '"Takım rekabeti her zaman var"', en: '"There\'s always competition in a squad"' }, effect: { morale: 0, relationship: 0 } },
        { text: { tr: '"Bunu sormana gerek yok"', en: '"You shouldn\'t need to ask that"' }, effect: { morale: -2, relationship: -2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] antrenmanlara isteksiz geliyor. Üç maçlık yedeklik onu olumsuz etkiliyor.',
        en: "[PLAYER] has been dragging himself to training. Three matches on the bench is taking its toll.",
      },
      options: [
        { text: { tr: 'Baş başa otur, konuşun ve çöz', en: 'Sit down one-on-one, talk it out, and find a solution' }, effect: { morale: 4, relationship: 3, mustStartNext: true } },
        { text: { tr: '"Disiplin kuralları herkese eşit uygulanır"', en: '"Discipline rules apply equally to everyone"' }, effect: { morale: -3, relationship: -3, discipline: 3 } },
        { text: { tr: '"Sezon uzun, sıranı bekle"', en: '"It\'s a long tournament — wait for your turn"' }, effect: { morale: 2, relationship: 1 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] yanına gelip oturuyor: "Hoca, neden oynatmıyorsunuz? Gerçekten anlamak istiyorum."',
        en: '[PLAYER] sits down next to you: "Boss, why aren\'t you playing me? I genuinely want to understand."',
      },
      options: [
        { text: { tr: 'Detaylı açıklama yap', en: 'Give him a detailed explanation' }, effect: { morale: 2, relationship: 2 } },
        { text: { tr: 'Söz ver ve güven ver', en: 'Make a promise and restore his confidence' }, effect: { mustStartNext: true, relationship: 3, morale: 3 } },
        { text: { tr: '"Şu an doğru zaman değil, konuşuruz"', en: '"Now isn\'t the right time — we\'ll talk later"' }, effect: { morale: -3, relationship: -2 } },
      ],
    },
  ],

  captainPoorMatch: [
    {
      dialogue: {
        tr: 'Kaptan [PLAYER] soyunma odasında ayağa kalkıyor: "Arkadaşlar, bu benim hatam. Ben toparlayacağım bu takımı."',
        en: 'Captain [PLAYER] stands up in the dressing room: "Lads, that\'s on me. I\'m going to turn this team around."',
      },
      options: [
        { text: { tr: '"Sana güveniyorum, çözersin"', en: '"I believe in you — you\'ll sort it"' }, effect: { morale: 3, teamMorale: 2 } },
        { text: { tr: '"Hep beraber toparlayacağız"', en: '"We\'ll all dig out together"' }, effect: { morale: 1, teamMorale: 1 } },
        { text: { tr: '"Kaptanlığını gözden geçireceğim"', en: '"I\'ll be reviewing the captaincy"' }, effect: { morale: -5, relationship: -4 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sana geliyor: "Hoca, bugün liderlik yapamadım. Bir dahakine farklı olacak, söz."',
        en: '[PLAYER] comes to you: "Boss, I didn\'t lead today. Next time will be different — I promise."',
      },
      options: [
        { text: { tr: 'Güven ver ve destekle', en: 'Show you believe in him and offer your support' }, effect: { morale: 3, relationship: 2, teamMorale: 1 } },
        { text: { tr: '"Haklısın, daha güçlü liderlik gerek"', en: '"You\'re right — I need stronger leadership from you"' }, effect: { morale: 1, relationship: 0 } },
        { text: { tr: '"Kaptanlığını gözden geçiririm"', en: '"I\'ll be reviewing the captaincy"' }, effect: { morale: -3, relationship: -3 } },
      ],
    },
    {
      dialogue: {
        tr: 'Kaptan [PLAYER] takım adına seninle konuşuyor: "Hoca, özür dileriz. Bu bizim hatamız."',
        en: 'Captain [PLAYER] speaks on behalf of the squad: "Boss, we\'re sorry. That\'s on all of us."',
      },
      options: [
        { text: { tr: 'Liderliğini alenen takdir et', en: 'Publicly acknowledge his leadership' }, effect: { morale: 4, relationship: 2, teamMorale: 2 } },
        { text: { tr: '"Söz değil, eylem görmek istiyorum"', en: '"I need actions, not words"' }, effect: { morale: 1, relationship: 0 } },
        { text: { tr: 'Hataları beraber analiz et', en: 'Sit down together and analyse what went wrong' }, effect: { morale: 2, teamMorale: 1 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sessiz soyunma odasını ayağa kaldırıyor: "Arkadaşlar! Bir maç kaybettik. Hepsi bu. Kalkacağız."',
        en: '[PLAYER] rallies the silent dressing room: "Lads! We lost one match. That\'s all. We get back up."',
      },
      options: [
        { text: { tr: 'Liderliğini destekle', en: 'Back his leadership fully' }, effect: { morale: 4, teamMorale: 3 } },
        { text: { tr: '"Sen yönet, ben arkandan gelirim"', en: '"You lead — I\'ve got your back"' }, effect: { morale: 2, teamMorale: 2 } },
        { text: { tr: '"Güzel söz, eylemle göster"', en: '"Nice words — now show it on the pitch"' }, effect: { morale: -2, relationship: -2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] seninle baş başa: "Hoca, hem takımı toparlayacağım hem de kendim daha iyi oynayacağım. İkisini de yapabilirim."',
        en: '[PLAYER] pulls you aside: "Boss, I\'m going to lift the team AND improve my own game. I can do both."',
      },
      options: [
        { text: { tr: '"Bu dürüstlüğe saygı duyuyorum"', en: '"I respect that honesty"' }, effect: { morale: 2, relationship: 2 } },
        { text: { tr: '"Şimdi takıma odaklan"', en: '"Focus on the team first for now"' }, effect: { morale: 1, teamMorale: 1 } },
        { text: { tr: '"İkisini birden zor, dikkatli ol"', en: '"Doing both is tough — be careful not to overstretch"' }, effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: {
        tr: 'Kaptan [PLAYER] antrenmana herkesten erken geliyor ve takım için plan hazırlıyor. Fark ediyorsun.',
        en: 'Captain [PLAYER] arrives first to training and has already prepared notes for the squad. You notice.',
      },
      options: [
        { text: { tr: 'Tüm takım önünde takdir et', en: 'Praise him in front of the whole squad' }, effect: { morale: 4, teamMorale: 3, relationship: 2 } },
        { text: { tr: 'Özel olarak teşekkür et', en: 'Thank him privately' }, effect: { morale: 2, relationship: 1 } },
        { text: { tr: '"Bu fazla, normal kal"', en: '"That\'s a bit much — just stay normal"' }, effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] yavaşça: "Hoca, bu takım benden daha iyisini hak ediyor. Ben de daha iyisini yapabilirim."',
        en: '[PLAYER] quietly: "Boss, this team deserves better from me. And I know I can do better."',
      },
      options: [
        { text: { tr: '"Bu öz eleştiri seni güçlü kılar"', en: '"That kind of self-awareness makes you stronger"' }, effect: { morale: 4, teamMorale: 2, relationship: 2 } },
        { text: { tr: '"Doğru, birlikte çalışalım"', en: '"You\'re right — let\'s work on it together"' }, effect: { morale: 2, relationship: 1 } },
        { text: { tr: '"Bu düşünce seni içten çökertir"', en: '"Thinking like that will only eat you up inside"' }, effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: {
        tr: 'Kaptan [PLAYER]: "Hoca, soyunma odası toplantısı yapabilir miyiz? Ben yönetirim."',
        en: 'Captain [PLAYER]: "Boss, can we have a dressing room meeting? I\'ll run it."',
      },
      options: [
        { text: { tr: '"Evet, sen yönet, arkadasın"', en: '"Yes — you run it, I\'ll be right behind you"' }, effect: { morale: 3, teamMorale: 3, relationship: 2 } },
        { text: { tr: '"Ben yönetirim, sen yanımda ol"', en: '"I\'ll run it — you stand alongside me"' }, effect: { morale: 1, teamMorale: 2 } },
        { text: { tr: '"Gerek görmüyorum"', en: '"I don\'t think that\'s necessary"' }, effect: { morale: -2, relationship: -1 } },
      ],
    },
  ],

  youngPlayerFirstCap: [
    {
      dialogue: {
        tr: '[PLAYER] gözleri parlayarak koşuyor yanına: "Hoca! İlk maçım! İnanamıyorum buna!"',
        en: '[PLAYER] sprints over with shining eyes: "Boss! My first cap! I can\'t believe it!"',
      },
      options: [
        { text: { tr: '"Gurur duyuyorum, böyle devam"', en: '"I\'m proud of you — keep going like this"' }, effect: { morale: 5, relationship: 3 } },
        { text: { tr: '"Güzel ama bu sadece başlangıç"', en: '"Great — but this is only the beginning"' }, effect: { morale: 2, relationship: 1 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sana sarılmak için koşuyor: "Hoca, teşekkürler! Bu... bu her şeydi benim için!"',
        en: '[PLAYER] runs over to hug you: "Boss, thank you! This... this meant everything to me!"',
      },
      options: [
        { text: { tr: 'Sarıl ve tebrik et', en: 'Hug him back and congratulate him' }, effect: { morale: 6, relationship: 4, teamMorale: 1 } },
        { text: { tr: '"Tebrikler, ama mütevazı kal"', en: '"Congratulations — but stay humble"' }, effect: { morale: 3, relationship: 2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] heyecandan elleri hafif titriyor: "Ailem tribündeydi hoca. Onlar için her şeyimi verdim."',
        en: "[PLAYER]'s hands are trembling slightly: \"My family was in the stands, boss. I gave everything for them.\"",
      },
      options: [
        { text: { tr: '"Ailenle gurur duyabilirsin"', en: '"Your family have every reason to be proud"' }, effect: { morale: 5, relationship: 3 } },
        { text: { tr: '"Her maçta bu ruhu istiyorum"', en: '"I want that spirit in every match"' }, effect: { morale: 4, relationship: 2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] biraz utangaç: "Hoca... çok heyecanlandım. Umarım hayal kırıklığı yaratmamışımdır."',
        en: '[PLAYER] is a little bashful: "Boss... I was so nervous. I hope I didn\'t disappoint you."',
      },
      options: [
        { text: { tr: '"Harika oynadın, gurur duydum"', en: '"You were brilliant — I\'m proud of you"' }, effect: { morale: 6, relationship: 3 } },
        { text: { tr: '"İyi başlangıç, daha iyisini yapacaksın"', en: '"Solid start — and you\'ll only get better"' }, effect: { morale: 3, relationship: 2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] diğer oyuncularla kutlanırken sana dönüyor: "Hoca, bu an için saatlerce çalıştım."',
        en: '[PLAYER] turns to you while teammates celebrate around him: "Boss, I worked for hours and hours for this moment."',
      },
      options: [
        { text: { tr: '"Emek her zaman karşılık bulur"', en: '"Hard work always pays off"' }, effect: { morale: 5, relationship: 3 } },
        { text: { tr: '"Bu sadece başlangıç, devam et"', en: '"This is just the start — keep going"' }, effect: { morale: 4, relationship: 2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] telefona bakıyor, gülümsüyor: "Annem mesaj atmış hoca: Seni gördüm, ağladım."',
        en: '[PLAYER] checks his phone and smiles: "My mum texted, boss: \'I saw you. I cried.\'"',
      },
      options: [
        { text: { tr: '"Geleceğine inanıyorum"', en: '"I believe in your future"' }, effect: { morale: 6, relationship: 4 } },
        { text: { tr: '"Takım için oyna, o zaman herkes mutlu"', en: '"Play for the team and everyone stays happy"' }, effect: { morale: 3, relationship: 2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sahadan çıkarken gözleri doluyor: "Özür dilerim hoca. Çok duygusalım şu an."',
        en: "[PLAYER]'s eyes fill up as he comes off the pitch: \"Sorry, boss. I'm just very emotional right now.\"",
      },
      options: [
        { text: { tr: '"Ağlamak utanılacak bir şey değil"', en: '"There\'s nothing to be ashamed of — let it out"' }, effect: { morale: 5, relationship: 4 } },
        { text: { tr: '"Bu his güç kaynağın olsun"', en: '"Let that feeling be your fuel"' }, effect: { morale: 4, relationship: 3 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] annesini arıyor, duyuyorsun: "Anne! Oynadım! Milli maç!" Sonra utanarak sana bakıyor.',
        en: '[PLAYER] calls his mum, and you overhear: "Mum! I played! A national match!" He then looks at you, embarrassed.',
      },
      options: [
        { text: { tr: 'Gül ve yanında dur', en: 'Laugh and give him a supportive nod' }, effect: { morale: 6, relationship: 4, teamMorale: 1 } },
        { text: { tr: '"Güzel, o enerjiyi sahaya taşı"', en: '"Love it — carry that energy onto the pitch"' }, effect: { morale: 4, relationship: 2 } },
      ],
    },
  ],

  threeMatchLosingStreak: [
    {
      dialogue: {
        tr: 'Kaptan [PLAYER] oyuncular adına sana geliyor: "Hoca, bir toplantı yapmalıyız. Bir şeyler yanlış gidiyor."',
        en: 'Captain [PLAYER] speaks for the squad: "Boss, we need a meeting. Something\'s not right."',
      },
      options: [
        { text: { tr: 'Haklısın, hemen yapalım', en: "You're right — let's do it now" }, effect: { morale: 4, teamMorale: 3 } },
        { text: { tr: '"Ben hallederim, güvenin bana"', en: '"I\'ll handle it — trust me"' }, effect: { morale: -1, relationship: -1 } },
        { text: { tr: '"Daha çok antrenman yapacağız"', en: '"We\'ll train harder"' }, effect: { teamMorale: -1, morale: -2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] soyunma odasında ayağa kalkıyor: "Üç maçtır kaybediyoruz arkadaşlar. Bu takım bu değiliz."',
        en: '[PLAYER] stands up in the dressing room: "Three losses, lads. This isn\'t who we are."',
      },
      options: [
        { text: { tr: 'Liderliğini destekle', en: 'Back his leadership' }, effect: { morale: 3, teamMorale: 3, relationship: 1 } },
        { text: { tr: '"Doğru, planımızı değiştireceğiz"', en: '"He\'s right — we\'re changing the plan"' }, effect: { morale: 1, teamMorale: 1 } },
        { text: { tr: '"Sen de analizi yap"', en: '"You need to look at yourself too"' }, effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sana geliyor: "Hoca, takımda bir özgüven sorunu var. Ne yapabiliriz?"',
        en: '[PLAYER] comes to you: "Boss, there\'s a confidence problem in the squad. What can we do?"',
      },
      options: [
        { text: { tr: 'Birlikte çözüm bul', en: 'Work out a solution together' }, effect: { morale: 4, teamMorale: 3 } },
        { text: { tr: '"Ben planı belirlerim"', en: '"I set the plan"' }, effect: { morale: 1, teamMorale: 0 } },
        { text: { tr: '"Bu geçer, sürece güven"', en: '"This will pass — trust the process"' }, effect: { morale: 0, teamMorale: -1 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sessiz soyunma odasını işaret ediyor: "Hoca, bir konuşma yapar mısınız? Takımın buna ihtiyacı var."',
        en: '[PLAYER] nods toward the silent dressing room: "Boss, will you say something? The team needs it."',
      },
      options: [
        { text: { tr: 'Güçlü bir konuşma yap', en: 'Deliver a powerful team talk' }, effect: { teamMorale: 5, morale: 2 } },
        { text: { tr: '"Sen yap, zaten kaptansın"', en: '"You do it — you\'re the captain"' }, effect: { morale: 2, relationship: 2, teamMorale: 2 } },
        { text: { tr: '"Kelimeler değil sonuçlar konuşur"', en: '"Results speak louder than words"' }, effect: { teamMorale: -1, morale: -1 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sesi biraz titrek: "Hoca, takım olarak bir şeyleri kaybettik. Nasıl geri alabiliriz?"',
        en: "[PLAYER]'s voice is slightly unsteady: \"Boss, we've lost something as a team. How do we get it back?\"",
      },
      options: [
        { text: { tr: 'Takım aktivitesi planla', en: 'Organise a team bonding session' }, effect: { teamMorale: 4, morale: 3 } },
        { text: { tr: 'Soyunma odası toplantısı yap', en: 'Hold a dressing room meeting' }, effect: { teamMorale: 3, morale: 2 } },
        { text: { tr: '"Daha çok çalışarak"', en: '"By working harder"' }, effect: { teamMorale: -1, morale: -2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] kapını çalıyor: "Hoca, oyuncular seninle konuşmak istiyor. Açık kapı toplantısı olabilir mi?"',
        en: '[PLAYER] knocks on your door: "Boss, the players want to talk to you. Can we have an open-door session?"',
      },
      options: [
        { text: { tr: 'Şimdi yapalım, kapılar açık', en: "Let's do it now — door's open" }, effect: { teamMorale: 4, morale: 3, relationship: 2 } },
        { text: { tr: '"Yarın organize ederiz"', en: '"Let\'s organise it for tomorrow"' }, effect: { teamMorale: 1, morale: 1 } },
        { text: { tr: '"Gerek görmüyorum, odaklanın"', en: '"I don\'t think that\'s necessary — just focus"' }, effect: { teamMorale: -2, morale: -2 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sessiz duran takım arkadaşlarını gösteriyor: "Hoca, herkes bezgin. Bir şeyler yapalım."',
        en: '[PLAYER] gestures toward his quiet teammates: "Boss, everyone is drained. We need to do something."',
      },
      options: [
        { text: { tr: 'Takım yemeği organize et', en: 'Organise a team dinner' }, effect: { teamMorale: 5, morale: 3 } },
        { text: { tr: 'Video analiz toplantısı yap', en: 'Hold a video analysis session' }, effect: { teamMorale: 2, morale: 1 } },
        { text: { tr: '"Antrenmanla çözülür"', en: '"Training will sort it"' }, effect: { teamMorale: -1, morale: -1 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] omuzları düşük: "Hoca, ben ne yapabilirim sizin için? Söyleyin, yaparım."',
        en: '[PLAYER] shoulders are slumped: "Boss, what can I do for you? Just tell me and I\'ll do it."',
      },
      options: [
        { text: { tr: '"Takıma liderlik et"', en: '"Lead the team"' }, effect: { morale: 4, teamMorale: 3, relationship: 2 } },
        { text: { tr: '"İyi oyna, o yeter"', en: '"Play well — that\'s enough"' }, effect: { morale: 2, teamMorale: 1 } },
        { text: { tr: '"Şimdilik dinle ve izle"', en: '"For now, just listen and observe"' }, effect: { morale: 1, teamMorale: 1 } },
      ],
    },
  ],

  starPlayerGoodForm: [
    {
      dialogue: {
        tr: '[PLAYER] antrenmandan çıkarken rahat adımlarla: "Hoca, şu an çok iyi hissediyorum. Kimse durduramaz bizi."',
        en: '[PLAYER] strides out of training with an easy grin: "Boss, I feel unstoppable right now. Nobody can stop us."',
      },
      options: [
        { text: { tr: '"Bu enerjiyi takıma ver"', en: '"Channel that energy into the team"' }, effect: { teamMorale: 3, morale: 1 } },
        { text: { tr: '"Güzel ama mütevazı kalmaya devam"', en: '"Great — but stay humble"' }, effect: { morale: -1, relationship: 0 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sırıtarak: "Hoca, formum çok iyi. Bu tempoyu korursam şampiyonluğa gidiyoruz."',
        en: '[PLAYER] grins: "Boss, I\'m in such good form. If I keep this up, we\'re going all the way."',
      },
      options: [
        { text: { tr: '"Bunu takıma da söyle"', en: '"Go tell the team that"' }, effect: { morale: 3, teamMorale: 2 } },
        { text: { tr: '"Devam et, kazanacağız"', en: '"Keep it going — we\'ll win this"' }, effect: { morale: 2, teamMorale: 1 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] bağırıyor: "Hoca! Bu hafta müthiş hissediyorum! Vay be!"',
        en: '[PLAYER] shouts across the pitch: "Boss! I feel incredible this week! What a feeling!"',
      },
      options: [
        { text: { tr: '"O enerjiyi takıma yay"', en: '"Spread that energy to the rest of the squad"' }, effect: { teamMorale: 3, morale: 2 } },
        { text: { tr: '"Güzel, sahaya bırak onu"', en: '"Love it — save it for the pitch"' }, effect: { morale: 2, relationship: 1 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sakin ama özgüvenli: "Hoca, son birkaç maçım çok iyiydi. Daha fazlasını yapabilirim."',
        en: '[PLAYER] is calm but confident: "Boss, I\'ve been really sharp the last few matches. I can do even more."',
      },
      options: [
        { text: { tr: 'Liderlik sorumluluğu ver', en: 'Give him added leadership responsibility' }, effect: { morale: 4, teamMorale: 2, relationship: 2 } },
        { text: { tr: '"Harika gidiyorsun, devam et"', en: '"You\'re doing brilliantly — keep it up"' }, effect: { morale: 3, relationship: 1 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] takım arkadaşlarını coşturuyor: "Arkadaşlar, bu formla namağlup geçebiliriz bu turnuvayı!"',
        en: '[PLAYER] fires up his teammates: "Lads, the way we\'re playing, we can go unbeaten through this tournament!"',
      },
      options: [
        { text: { tr: 'Liderliğini destekle', en: 'Back his leadership' }, effect: { morale: 3, teamMorale: 3, relationship: 2 } },
        { text: { tr: '"Dikkatli ol, erken konuşma"', en: '"Careful — don\'t speak too soon"' }, effect: { morale: 0, relationship: 0 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] basına iyi laflar etmiş, seni ve takımı övmüş. Herkes okudu.',
        en: "[PLAYER] gave a glowing interview, praising you and the squad. Everyone's seen it.",
      },
      options: [
        { text: { tr: 'Teşekkür et ve ödüllendir', en: 'Thank him and acknowledge it' }, effect: { morale: 4, relationship: 3 } },
        { text: { tr: '"Güzel ama odak hep maçta olsun"', en: '"Appreciated — but keep your focus on the game"' }, effect: { morale: 1, relationship: 0 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] yeni bir kişisel rekor kırdı ve soyunma odasında kutlamak istiyor.',
        en: '[PLAYER] has just broken a personal record and wants to celebrate with the squad.',
      },
      options: [
        { text: { tr: 'Takımla birlikte kutla', en: 'Celebrate it together as a team' }, effect: { morale: 5, teamMorale: 3, relationship: 2 } },
        { text: { tr: 'Kısa tut ve devam', en: 'Keep it brief and move on' }, effect: { morale: 3, relationship: 1 } },
      ],
    },
    {
      dialogue: {
        tr: '[PLAYER] sana geliyor: "Hoca, bu formu korumak için ne yapmalıyım? Bir tavsiye var mı?"',
        en: '[PLAYER] comes to you: "Boss, what should I do to stay in this form? Any advice?"',
      },
      options: [
        { text: { tr: 'Birlikte kişisel plan çiz', en: 'Work out a personal plan together' }, effect: { morale: 4, relationship: 3 } },
        { text: { tr: '"Dinlenmeye de dikkat et"', en: '"Make sure you\'re getting enough rest too"' }, effect: { morale: 2, relationship: 1 } },
      ],
    },
  ],
}
