import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S=sys.argv[2]
OUT=sys.argv[1]
SER=lambda s: ImageFont.truetype('/System/Library/Fonts/Supplemental/PTSerif.ttc', s, index=3)
SAN=lambda s: ImageFont.truetype('/System/Library/Fonts/Supplemental/PTSans.ttc', s, index=0)
C={
'library':{'en':('No ads, no account','Your library stays with you'),'ru':('Без рекламы и без аккаунта','Ваша библиотека остаётся у вас'),'fr':('Sans publicité ni compte','Votre bibliothèque reste chez vous'),'de':('Ohne Werbung, ohne Konto','Ihre Bibliothek bleibt bei Ihnen'),'es':('Sin anuncios ni cuenta','Tu biblioteca se queda contigo')},
'read':{'en':('One book on every device','Close it on iPhone, carry on from the same page on iPad or Mac'),'ru':('Одна книга на всех устройствах','Закрыли на iPhone — продолжили на iPad или Mac с той же страницы'),'fr':('Un livre sur tous vos appareils','Fermez-le sur l’iPhone, reprenez à la même page sur iPad ou Mac'),'de':('Ein Buch auf allen Geräten','Am iPhone schließen, auf iPad oder Mac auf derselben Seite weiterlesen'),'es':('Un libro en todos tus dispositivos','Ciérralo en el iPhone y sigue en la misma página en el iPad o el Mac')},
'select':{'en':('FB2, EPUB and TXT as they are','Covers, footnotes, bookmarks and highlights in four colours'),'ru':('FB2, EPUB и TXT — как есть','Обложки, сноски, закладки и закраски в четыре цвета'),'fr':('FB2, EPUB et TXT tels quels','Couvertures, notes, signets et surlignage en quatre couleurs'),'de':('FB2, EPUB und TXT, wie sie sind','Cover, Fußnoten, Lesezeichen und Markierungen in vier Farben'),'es':('FB2, EPUB y TXT tal cual','Portadas, notas, marcadores y subrayado en cuatro colores')},
'night':{'en':('Easy on the eyes','Five tuned themes, from paper to true black'),'ru':('Удобно глазам','Пять выверенных тем — от бумаги до чистого чёрного'),'fr':('Doux pour les yeux','Cinq thèmes soignés, du papier au noir pur'),'de':('Angenehm für die Augen','Fünf abgestimmte Themen, von Papier bis echtem Schwarz'),'es':('Cómodo para la vista','Cinco temas cuidados, del papel al negro puro')},
'catalog':{'en':('70,000 books to start with','Project Gutenberg built in, your Calibre library over OPDS'),'ru':('70 000 книг для начала','Project Gutenberg прямо в приложении, Calibre — по OPDS'),'fr':('70 000 livres pour commencer','Project Gutenberg intégré, votre bibliothèque Calibre via OPDS'),'de':('70.000 Bücher zum Start','Project Gutenberg eingebaut, Ihre Calibre-Bibliothek per OPDS'),'es':('70.000 libros para empezar','Project Gutenberg integrado y tu biblioteca Calibre por OPDS')},
'dict':{'en':('A dictionary one tap away','The meaning of a word, even in an inflected form'),'ru':('Словарь в одно касание','Значение слова, даже если оно в другой форме'),'fr':('Un dictionnaire à portée de doigt','Le sens d’un mot, même conjugué ou accordé'),'de':('Das Wörterbuch einen Tipp entfernt','Die Bedeutung eines Wortes, auch in gebeugter Form'),'es':('El diccionario a un toque','El significado de una palabra, aunque esté conjugada')},
}
PHONE={'library':'f/{s}-library.png','read':'{s}-iphone-read.png','select':'f/{s}-select.png','night':'f/{s}-night.png','catalog':'f/{s}-catalog.png','dict':'f/{s}-dict.png'}
TABLET={'library':'{s}-ipad-library.png','read':'t-{s}-select.png','night':'t-{s}-night.png','catalog':'t-{s}-catalog.png','dict':'t-{s}-dict.png'}
ORDER_P=['library','read','select','night','catalog','dict']
ORDER_T=['library','read','night','catalog','dict']
def greedy(d,text,font,maxw):
    words=text.split(' '); lines=[]; cur=''
    for w in words:
        t=(cur+' '+w).strip()
        if not cur or d.textlength(t,font=font)<=maxw: cur=t
        else: lines.append(cur); cur=w
    lines.append(cur); return lines
def wrap(d,text,font,maxw):
    lines=greedy(d,text,font,maxw)
    if len(lines)<2: return lines
    lo,hi=maxw*0.4,maxw
    while hi-lo>4:
        mid=(lo+hi)/2
        if len(greedy(d,text,font,mid))<=len(lines): hi=mid
        else: lo=mid
    return greedy(d,text,font,hi)
def rounded(im,r):
    m=Image.new('L',im.size,0); ImageDraw.Draw(m).rounded_rectangle((0,0,im.width-1,im.height-1),r,fill=255); im=im.convert('RGBA'); im.putalpha(m); return im
def slide(W,H,key,lang,shot,bez,rad,top,tsize,ssize,maxw):
    dark=key=='night'
    bg=(27,25,22) if dark else (243,237,226); fg=(232,225,212) if dark else (42,38,32); mu=(166,157,143) if dark else (107,99,87)
    c=Image.new('RGBA',(W,H),bg+(255,)); d=ImageDraw.Draw(c)
    title,sub=C[key][lang]
    tf=SER(tsize); sf=SAN(ssize)
    tl=wrap(d,title,tf,maxw)
    while len(tl)>2: tf=SER(tf.size-4); tl=wrap(d,title,tf,maxw)
    sl=wrap(d,sub,sf,maxw)
    y=top
    for l in tl: d.text((W/2,y),l,font=tf,fill=fg,anchor='ma'); y+=round(tf.size*1.16)
    y+=round(ssize*0.55)
    for l in sl: d.text((W/2,y),l,font=sf,fill=mu,anchor='ma'); y+=round(ssize*1.3)
    y+=round(ssize*0.9)
    avail=H-y-round(H*0.03)
    im=Image.open(shot).convert('RGB')
    ih=avail-2*bez; iw=round(ih*im.width/im.height)
    if iw+2*bez>W*0.9: iw=round(W*0.9)-2*bez; ih=round(iw*im.height/im.width)
    im=im.resize((iw,ih),Image.LANCZOS)
    fw,fh=iw+2*bez,ih+2*bez
    frame=Image.new('RGBA',(fw,fh),(17,17,17,255) if not dark else (58,54,50,255))
    frame.alpha_composite(rounded(im,max(rad-bez,8)),(bez,bez)); frame=rounded(frame,rad)
    x=(W-fw)//2
    sh=Image.new('RGBA',(W,H),(0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle((x,y+30,x+fw,y+fh+30),rad,fill=(0,0,0,110 if dark else 70)); c.alpha_composite(sh.filter(ImageFilter.GaussianBlur(40)))
    c.alpha_composite(frame,(x,y))
    return c.convert('RGB')
for lang in ['en','ru','fr','de','es']:
    s='ru' if lang=='ru' else 'en'
    for dev,W,H,order,src,bez,rad,top,ts,ss,mw in [('iphone-6.3',1206,2622,ORDER_P,PHONE,20,110,174,95,53,1080),('iphone-6.9',1320,2868,ORDER_P,PHONE,22,120,190,104,58,1180),('ipad-13',2752,2064,ORDER_T,TABLET,30,64,120,112,60,2300)]:
        os.makedirs(f'{OUT}/{lang}/{dev}',exist_ok=True)
        for i,k in enumerate(order,1):
            slide(W,H,k,lang,f'{S}/'+src[k].format(s=s),bez,rad,top,ts,ss,mw).save(f'{OUT}/{lang}/{dev}/{i:02d}-{k}.png')
print('done')
