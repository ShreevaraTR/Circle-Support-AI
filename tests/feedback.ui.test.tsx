import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/ui/App';
import { DEMO_TICKETS } from '../src/data/demoTickets';
import { KNOWLEDGE_BASE } from '../src/data/knowledge';
import { analyzeProductSignals, analyzeSupportTrends, generateProductFeedback } from '../src/engine';
import { formatForJira, formatForSlack, formatReport } from '../src/engine/feedbackFormat';

const go = async (hash: string) => {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};
const clickLink = async (el: HTMLElement) => go(el.getAttribute('href')!);

let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  window.location.hash = '';
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

async function liveJoinHandoff() {
  const report = await analyzeSupportTrends(DEMO_TICKETS, KNOWLEDGE_BASE);
  const signal = (await analyzeProductSignals(report, DEMO_TICKETS)).find((s) => s.id === 'live-join')!;
  return generateProductFeedback(signal, DEMO_TICKETS, KNOWLEDGE_BASE);
}

describe('Support Trends → Product Feedback workflow', () => {
  it('opens a trends opportunity as a product signal, generates a handoff and copies it', async () => {
    render(<App />);
    await go('#/trends');
    const opportunities = await screen.findAllByTestId('opportunity');
    const liveOpp = opportunities.find((o) => o.textContent?.includes('Can’t join / see a live stream'))!;
    const btn = await within(liveOpp).findByTestId('generate-feedback');
    expect(btn).toHaveTextContent('Generate Product Feedback');
    expect(btn.getAttribute('href')).toBe('#/feedback/live-join');
    await clickLink(btn);

    // Signal + supporting tickets
    const detail = await screen.findByTestId('signal-detail');
    expect(within(detail).getByText('Live Stream join issues on mobile')).toBeInTheDocument();
    expect(within(detail).getByTestId('signal-count')).toHaveTextContent('6');
    for (const id of ['DEMO-031', 'DEMO-036', 'DEMO-041', 'DEMO-045', 'DEMO-047', 'DEMO-049']) {
      expect(within(detail).getByTestId(`evidence-${id}`).getAttribute('href')).toBe(`#/copilot/${id}`);
    }
    const rec = screen.getByTestId('signal-recommendation');
    expect(within(rec).getByText('Prototype recommendation · synthetic data')).toBeInTheDocument();

    // Generate the handoff
    fireEvent.click(within(rec).getByTestId('generate-handoff'));
    const handoff = await screen.findByTestId('handoff');
    const expected = await liveJoinHandoff();
    expect(within(handoff).getByTestId('handoff-title')).toHaveTextContent(expected.title);
    expect(within(handoff).getByText(/^Human review required\.$/)).toBeInTheDocument();
    expect(within(handoff).getByTestId('handoff-source')).toHaveTextContent('Source: Synthetic support dataset');
    expect(within(handoff).getAllByText('Prototype recommendation · synthetic data').length).toBeGreaterThan(0);
    expect(within(handoff).getByText('Prototype priority — not Circle’s internal priority policy.')).toBeInTheDocument();
    for (const n of ['1. Title', '2. Problem', '3. Customer impact', '4. Evidence', '5. Observed pattern', '6. What support tried', '7. Suggested investigation', '8. Priority', '9. Source', '10. Human review']) {
      expect(within(handoff).getByText(n)).toBeInTheDocument();
    }
    expect(handoff.textContent).not.toMatch(/Circle('|’)s (customers|users|most common)|Circle (customers|users) (are|have)/i);

    // Copy actions only write formatted text to the clipboard
    fireEvent.click(within(handoff).getByTestId('copy-slack'));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(formatForSlack(expected)));
    fireEvent.click(within(handoff).getByTestId('copy-jira'));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(formatForJira(expected)));
    fireEvent.click(within(handoff).getByTestId('copy-report'));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(formatReport(expected)));
    expect(writeText).toHaveBeenCalledTimes(3);
  });

  it('handoff evidence IDs open the corresponding ticket in the Copilot', async () => {
    render(<App />);
    await go('#/feedback/live-join');
    fireEvent.click(await screen.findByTestId('generate-handoff'));
    const link = await screen.findByTestId('handoff-evidence-DEMO-041');
    expect(link.getAttribute('href')).toBe('#/copilot/DEMO-041');
    await clickLink(link);
    const context = await screen.findByTestId('ticket-context');
    expect(within(context).getByText('DEMO-041')).toBeInTheDocument();
    expect(within(context).getByTestId('ticket-disclaimer')).toHaveTextContent('Not Circle customer data.');
    expect(await screen.findByTestId('category')).toHaveTextContent('Live Streams');
  });
});

describe('Product Feedback view', () => {
  it('shows the synthetic-data labels and is reachable from the sidebar', async () => {
    render(<App />);
    await go('#/copilot');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await clickLink(within(nav).getByRole('link', { name: /Product Feedback/ }));
    const page = await screen.findByTestId('product-feedback');
    expect(within(page).getByRole('heading', { name: 'Product Feedback' })).toBeInTheDocument();
    expect(within(page).getByText('Turn recurring support signals into actionable product feedback.')).toBeInTheDocument();
    expect(within(page).getByText('Portfolio prototype · Synthetic support data')).toBeInTheDocument();
    expect(within(page).getByText(/Not Circle customer data\./)).toBeInTheDocument();
    // Defaults to the first signal and does not generate a handoff until asked.
    expect(within(page).getByTestId('signal-detail')).toBeInTheDocument();
    expect(within(page).queryByTestId('handoff')).toBeNull();
  });

  it('switching signals resets the generated handoff', async () => {
    render(<App />);
    await go('#/feedback/live-join');
    fireEvent.click(await screen.findByTestId('generate-handoff'));
    await screen.findByTestId('handoff');
    await clickLink(screen.getByTestId('signal-auth-sso-access'));
    await waitFor(() => expect(screen.queryByTestId('handoff')).toBeNull());
    expect(within(screen.getByTestId('signal-detail')).getByText('SSO sign-in access failures')).toBeInTheDocument();
  });
});
