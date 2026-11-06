import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Mail, Send, CheckCircle2, ExternalLink, ShieldCheck, AlertCircle, Code2 } from 'lucide-react';
import { getApiBaseUrl } from '../config/api';

function GithubIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export default function ContactModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      setErrorMessage('');
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getMailtoLink = () => {
    const subject = encodeURIComponent(`ShadowLens Inquiry from ${name || email || 'Visitor'}`);
    const body = encodeURIComponent(
      `Name: ${name || 'N/A'}\nEmail: ${email}\n\nMessage:\n${message}\n\n---\nSent via ShadowLens PhishShield-X Platform`
    );
    return `mailto:singhalyash307@gmail.com?subject=${subject}&body=${body}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) return;

    setIsSubmitting(true);
    setErrorMessage('');

    // 1. Submit to backend API to log in SQLite & inquiries.json
    try {
      await fetch(`${getApiBaseUrl()}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });
    } catch (err) {
      console.warn('Backend contact logging notice:', err);
    }

    // 2. Open email client directly with mailto addressed to singhalyash307@gmail.com
    const mailtoUrl = getMailtoLink();
    window.location.href = mailtoUrl;

    setIsSubmitting(false);
    setIsSent(true);
  };

  const handleReset = () => {
    setName('');
    setEmail('');
    setMessage('');
    setIsSent(false);
    setErrorMessage('');
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200">
      
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
      />

      {/* Pure Black Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl bg-black border border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.95)] p-6 sm:p-8 z-10 overflow-hidden font-['Plus_Jakarta_Sans']">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close dialog"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="space-y-1.5 mb-5">
          <div className="flex items-center gap-2 text-xs font-mono font-semibold tracking-wider text-[#38BDF8]">
            <ShieldCheck size={14} className="text-[#38BDF8]" />
            <span>RESEARCH &amp; INQUIRIES</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Contact Yash Singhal
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
            Have questions about ShadowLens Evidential Deep Learning, benchmark evaluations, or collaboration? Send a message directly.
          </p>
        </div>

        {/* GitHub Profile & Source Code Channels */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {/* GitHub Profile */}
          <a
            href="https://github.com/yashsinghal1234"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 p-3 rounded-xl bg-[#0A0A0A] hover:bg-[#141414] border border-white/10 hover:border-white/20 transition-all group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center shrink-0">
              <GithubIcon size={15} />
            </div>
            <div className="overflow-hidden">
              <div className="text-[10px] text-neutral-400 font-medium">GitHub Profile</div>
              <div className="text-xs text-white font-semibold flex items-center gap-1 group-hover:text-[#38BDF8] transition-colors truncate">
                <span>@yashsinghal1234</span>
                <ExternalLink size={10} className="opacity-60 shrink-0" />
              </div>
            </div>
          </a>

          {/* Source Code */}
          <a
            href="https://github.com/yashsinghal1234/PhishShield-X"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 p-3 rounded-xl bg-[#0A0A0A] hover:bg-[#141414] border border-white/10 hover:border-white/20 transition-all group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-[#0047FF]/20 text-[#38BDF8] flex items-center justify-center shrink-0">
              <Code2 size={15} />
            </div>
            <div className="overflow-hidden">
              <div className="text-[10px] text-neutral-400 font-medium">Source Code</div>
              <div className="text-xs text-white font-semibold flex items-center gap-1 group-hover:text-[#38BDF8] transition-colors truncate">
                <span>PhishShield-X</span>
                <ExternalLink size={10} className="opacity-60 shrink-0" />
              </div>
            </div>
          </a>
        </div>

        {/* Message Form or Confirmation State */}
        {isSent ? (
          <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in-95 duration-200 bg-[#0A0A0A] rounded-xl border border-white/10">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Opening in Email Client...</h3>
              <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
                Your message has been addressed directly to Yash Singhal (<span className="text-neutral-200 font-mono">singhalyash307@gmail.com</span>) in your default mail app and recorded in our audit log.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5 w-full">
              <a
                href={getMailtoLink()}
                className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Mail size={13} />
                <span>Re-open in Mail App</span>
              </a>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-2 px-3 rounded-xl bg-[#0047FF] hover:bg-[#0039CC] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Send Another Message
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Alex Rivera"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0A] border border-white/10 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Email Address <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@research.org"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0A] border border-white/10 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Message or Security Inquiry <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi Yash, I'd like to discuss the EDL model architecture or paper..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0A] border border-white/10 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0047FF] hover:bg-[#0039CC] text-white text-sm font-semibold tracking-wide transition-all shadow-md shadow-[#0047FF]/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Transmitting message...</span>
              ) : (
                <>
                  <Send size={14} />
                  <span>Send Message to Yash</span>
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>,
    document.body
  );
}
