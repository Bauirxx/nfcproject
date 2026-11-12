import { SOCIAL_PLATFORMS } from '@nfc-business/shared/constants';
import { readableTextOn } from '@nfc-business/shared/contrast';
import {
  buildCardUrl,
  buildMailtoUrl,
  buildMapsUrl,
  buildProfileUrl,
  buildTelUrl,
  buildWhatsAppUrl,
  toSafeHttpsUrl,
  toSafeImageUrl,
} from '@nfc-business/shared/links';
import type { PublicCard } from '@nfc-business/shared/schemas';
import {
  ChevronDown,
  Download,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
  Share2,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { publicTexts } from '@/shared/i18n/public';
import { parsePublicCard } from './parse-public-card';
import { PublicQr } from './public-qr';
import { recordPublicEvent, type PublicKind } from './public-events';

type LoadState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; card: PublicCard };

export function PublicCardPage({ kind, id }: { kind: PublicKind; id: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const viewed = useRef(false);

  useEffect(() => {
    let active = true;
    const endpoint = kind === 'card' ? endpoints.public.card(id) : endpoints.public.profile(id);
    apiFetch(endpoint)
      .then((data) => {
        if (!active) return;
        const card = parsePublicCard(data);
        if (!card) {
          setState({ status: 'unavailable' });
          return;
        }
        setState({ status: 'ready', card });
        if (!viewed.current) {
          viewed.current = true;
          recordPublicEvent(kind, id, 'view');
        }
      })
      .catch(() => {
        if (active) setState({ status: 'unavailable' });
      });
    return () => {
      active = false;
    };
  }, [kind, id]);

  if (state.status === 'loading') {
    return <Centered>{publicTexts.loading}</Centered>;
  }
  if (state.status === 'unavailable') {
    return <Unavailable />;
  }
  return <CardView kind={kind} id={id} card={state.card} />;
}

function Centered({ children }: { children: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-center text-muted-foreground">
      {children}
    </main>
  );
}

function Unavailable() {
  useEffect(() => {
    document.title = publicTexts.unavailable.title;
  }, []);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <h1 className="text-xl font-semibold">{publicTexts.unavailable.title}</h1>
      <p className="text-muted-foreground">{publicTexts.unavailable.body}</p>
    </main>
  );
}

interface CardAction {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  external: boolean;
  download: boolean;
  onActivate?: () => void;
}

function buildActions(card: PublicCard, kind: PublicKind, id: string, vcfHref: string): CardAction[] {
  const actions: CardAction[] = [
    {
      key: 'vcf',
      label: publicTexts.actions.saveContact,
      href: vcfHref,
      icon: Download,
      external: false,
      download: true,
      onActivate: () => recordPublicEvent(kind, id, 'vcf_download'),
    },
  ];

  card.contacts.forEach((contact, index) => {
    const key = `${contact.type}-${index}`;
    switch (contact.type) {
      case 'phone': {
        const href = buildTelUrl(contact.value);
        if (href) actions.push({ key, label: publicTexts.actions.call, href, icon: Phone, external: false, download: false });
        break;
      }
      case 'whatsapp': {
        const href = buildWhatsAppUrl(contact.value);
        if (href)
          actions.push({
            key,
            label: publicTexts.actions.whatsapp,
            href,
            icon: MessageCircle,
            external: true,
            download: false,
            onActivate: () => recordPublicEvent(kind, id, 'whatsapp_click'),
          });
        break;
      }
      case 'email': {
        const href = buildMailtoUrl(contact.value);
        if (href)
          actions.push({
            key,
            label: publicTexts.actions.email,
            href,
            icon: Mail,
            external: false,
            download: false,
            onActivate: () => recordPublicEvent(kind, id, 'email_click'),
          });
        break;
      }
      case 'website': {
        const href = toSafeHttpsUrl(contact.value);
        if (href) actions.push({ key, label: publicTexts.actions.website, href, icon: Globe, external: true, download: false });
        break;
      }
      case 'location': {
        const href = buildMapsUrl(contact.value);
        if (href) actions.push({ key, label: publicTexts.actions.location, href, icon: MapPin, external: true, download: false });
        break;
      }
    }
  });

  return actions;
}

function CardView({ kind, id, card }: { kind: PublicKind; id: string; card: PublicCard }) {
  const [qrOpen, setQrOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${card.displayName} · ${publicTexts.footer}`;
  }, [card.displayName]);

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const cardUrl = (kind === 'card' ? buildCardUrl(origin, id) : buildProfileUrl(origin, id)) ?? origin;
  const vcfHref = kind === 'card' ? endpoints.public.cardVcf(id) : endpoints.public.profileVcf(id);
  const photo = toSafeImageUrl(card.photoUrl);
  const { backgroundColor, textColor, primaryColor } = card.theme;
  const onPrimary = readableTextOn(primaryColor);
  const actions = buildActions(card, kind, id, vcfHref);

  async function share() {
    setShareMessage(null);
    const data = { title: publicTexts.share.title(card.displayName), url: cardUrl };
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(data);
      } catch {
        // Partilha cancelada: sem mensagem.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(cardUrl);
      setShareMessage(publicTexts.share.copied);
    } catch {
      setShareMessage(publicTexts.share.failed);
    }
  }

  return (
    <main
      style={{ backgroundColor, color: textColor }}
      className="flex min-h-dvh flex-col items-center px-4 py-10"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <header className="flex flex-col items-center gap-2 text-center">
          {photo ? (
            <img src={photo} alt={publicTexts.photoAlt(card.displayName)} className="size-28 rounded-full object-cover" />
          ) : (
            <span className="flex size-28 items-center justify-center rounded-full bg-black/10">
              <UserRound aria-hidden="true" className="size-14 opacity-70" />
            </span>
          )}
          <h1 className="text-2xl font-semibold">{card.displayName}</h1>
          {card.title ? <p className="text-lg">{card.title}</p> : null}
          {card.company ? <p className="opacity-80">{card.company}</p> : null}
          {card.bio ? <p className="mt-2 whitespace-pre-line text-sm opacity-90">{card.bio}</p> : null}
        </header>

        <section aria-label={publicTexts.actionsHeading} className="flex w-full flex-col gap-2">
          {actions.map((action) => (
            <a
              key={action.key}
              href={action.href}
              onClick={action.onActivate}
              style={{ backgroundColor: primaryColor, color: onPrimary }}
              className="flex items-center gap-3 rounded-lg px-4 py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              {...(action.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              {...(action.download ? { download: true } : {})}
            >
              <action.icon aria-hidden="true" className="size-5 shrink-0" />
              <span>{action.label}</span>
              {action.external ? (
                <>
                  <ExternalLink aria-hidden="true" className="ml-auto size-4 opacity-70" />
                  <span className="sr-only">{publicTexts.newTab}</span>
                </>
              ) : null}
            </a>
          ))}
        </section>

        {card.socialLinks.length > 0 ? (
          <section aria-label={publicTexts.socialHeading} className="flex w-full flex-col gap-2">
            <h2 className="text-sm font-semibold opacity-80">{publicTexts.socialHeading}</h2>
            <ul className="flex flex-col gap-1">
              {card.socialLinks.map((link, index) => {
                const href = toSafeHttpsUrl(link.url);
                if (!href) return null;
                return (
                  <li key={`${link.platform}-${index}`}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md px-2 py-2 underline-offset-4 hover:underline"
                    >
                      <ExternalLink aria-hidden="true" className="size-4 opacity-70" />
                      <span>{SOCIAL_PLATFORMS[link.platform].label}</span>
                      <span className="sr-only">{publicTexts.newTab}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="flex w-full flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setQrOpen((open) => !open)}
            aria-expanded={qrOpen}
            aria-controls="painel-qr"
            className="inline-flex items-center gap-2 rounded-md border border-current/30 px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            <QrCode aria-hidden="true" className="size-4" />
            <span>{qrOpen ? publicTexts.qr.hide : publicTexts.qr.show}</span>
            <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${qrOpen ? 'rotate-180' : ''}`} />
          </button>
          {qrOpen ? (
            <div id="painel-qr" className="flex flex-col items-center gap-2 rounded-lg bg-white p-4">
              <PublicQr value={cardUrl} title={publicTexts.qr.alt(card.displayName)} />
              <p className="max-w-56 text-center text-xs text-black/70">{publicTexts.qr.hint}</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={share}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            <Share2 aria-hidden="true" className="size-4" />
            <span>{publicTexts.share.button}</span>
          </button>
          <p aria-live="polite" className="min-h-4 text-xs opacity-80">
            {shareMessage}
          </p>
        </div>

        <footer className="pt-4 text-xs opacity-60">{publicTexts.footer}</footer>
      </div>
    </main>
  );
}
