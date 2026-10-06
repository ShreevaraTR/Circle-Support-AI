import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/ui/App';
import { DEMO_TICKETS } from '../src/data/demoTickets';
import { CATEGORY_LABELS } from '../src/engine';

const go = async (hash: string) => {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};

beforeEach(() => {
  window.location.hash = '';
});

describe('Demo tickets → Copilot workflow', () => {
  for (const id of ['DEMO-001', 'DEMO-012', 'DEMO-031', 'DEMO-045', 'DEMO-050']) {
    it(`opens ${id} in the Copilot with the issue loaded and analysed`, async () => {
      const ticket = DEMO_TICKETS.find((t) => t.id === id)!;
      render(<App />);
      await go('#/tickets');
      fireEvent.click(await screen.findByTestId(`ticket-${id}`));
      await waitFor(() => expect(window.location.hash).toBe(`#/copilot/${id}`));

      const context = await screen.findByTestId('ticket-context');
      expect(within(context).getByText(id)).toBeInTheDocument();
      expect(within(context).getByText('Demo data')).toBeInTheDocument();
      expect(within(context).getByTestId('ticket-disclaimer')).toHaveTextContent('Synthetic support scenarios — created for this portfolio prototype. Not Circle customer data.');
      expect((screen.getByPlaceholderText("Describe the customer's problem…") as HTMLTextAreaElement).value).toContain(ticket.body);

      const analysis = await screen.findByTestId('analysis');
      expect(within(analysis).getByTestId('category')).toHaveTextContent(CATEGORY_LABELS[ticket.category]);
      expect((within(analysis).getByTestId('response') as HTMLTextAreaElement).value).toMatch(new RegExp(`^Hi ${ticket.customerName},`));
    });
  }

  it('shows the synthetic-data label on the ticket list', async () => {
    render(<App />);
    await go('#/tickets');
    expect(await screen.findByText(/Synthetic support scenarios — created for this portfolio prototype\. Not Circle customer data\./)).toBeInTheDocument();
    expect(screen.getAllByText(/^DEMO-\d{3}$/).length).toBe(DEMO_TICKETS.length);
  });
});

describe('Copilot provenance labels', () => {
  it('labels knowledge as fact, everything generated as recommendation, and requires human review', async () => {
    render(<App />);
    await go('#/copilot');
    fireEvent.click(screen.getByRole('button', { name: 'Live stream · mobile' }));
    const analysis = await screen.findByTestId('analysis');

    expect(within(analysis).getByText(/Human review required/)).toBeInTheDocument();
    const sources = within(analysis).getByTestId('sources');
    expect(sources.querySelector('[data-provenance="fact"]')).not.toBeNull();
    expect(sources.querySelector('[data-provenance="recommendation"]')).toBeNull();
    for (const link of within(sources).getAllByRole('link')) expect(link.getAttribute('href')).toMatch(/^https:\/\/help\.circle\.so\//);

    const escalation = within(analysis).getByTestId('escalation-card');
    expect(escalation.querySelector('[data-provenance="recommendation"]')).not.toBeNull();
    expect(within(escalation).getByText(/Prototype recommendation — not Circle’s internal escalation policy/)).toBeInTheDocument();

    // Every card in the analysis carries a provenance badge.
    const cards = analysis.querySelectorAll('.card');
    for (const card of cards) expect(card.querySelector('[data-provenance]')).not.toBeNull();
  });

  it('says plainly when no public documentation was found', async () => {
    render(<App />);
    await go('#/copilot');
    fireEvent.click(screen.getByRole('button', { name: 'Undocumented ask' }));
    expect(await screen.findByTestId('no-docs')).toHaveTextContent('No public Circle documentation found for this issue.');
  });
});

describe('Support Trends dashboard', () => {
  it('renders KPIs and scopes every claim to the synthetic dataset', async () => {
    render(<App />);
    await go('#/trends');
    const trends = await screen.findByTestId('trends');
    expect(within(trends).getByTestId('kpi-total')).toHaveTextContent(String(DEMO_TICKETS.length));
    expect(within(trends).getByText(/Synthetic support scenarios — created for this portfolio prototype/)).toBeInTheDocument();
    expect(within(trends).getByText(/Demo support data — 50 synthetic tickets/)).toBeInTheDocument();
    expect(within(trends).getByText(/In this synthetic dataset, Authentication \/ SSO is the most common category/)).toBeInTheDocument();
    expect(within(trends).getByText('Prototype recommendation · synthetic data')).toBeInTheDocument();
    expect(within(trends).getAllByTestId('opportunity').length).toBeGreaterThanOrEqual(3);
    expect(trends.textContent).not.toMatch(/Circle('|’)s most common/);
  });

  it('links evidence ticket IDs back into the Copilot', async () => {
    render(<App />);
    await go('#/trends');
    const first = (await screen.findAllByTestId('opportunity'))[0];
    const ref = within(first).getAllByRole('link').find((a) => /^DEMO-\d{3}$/.test(a.textContent ?? ''))!;
    expect(ref.getAttribute('href')).toMatch(/^#\/copilot\/DEMO-\d{3}$/);
  });
});

describe('Knowledge Base view', () => {
  it('labels content as public Circle documentation and links only to help.circle.so', async () => {
    render(<App />);
    await go('#/knowledge');
    expect(await screen.findByText('Public Circle documentation')).toBeInTheDocument();
    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('target') === '_blank');
    expect(links.length).toBeGreaterThan(20);
    for (const a of links) expect(a.getAttribute('href')).toMatch(/^https:\/\/help\.circle\.so\//);
  });
});
