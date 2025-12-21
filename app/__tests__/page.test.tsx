import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from '../page';

// Mock Next.js Link component
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
  MockLink.displayName = 'Link';
  return MockLink;
});

// Mock fetch
global.fetch = jest.fn();

describe('Home Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      new Promise(() => {}) // Never resolves to keep loading state
    );

    render(<Home />);

    expect(screen.getByRole('heading', { name: /orchestra dashboard/i })).toBeInTheDocument();
  });

  it('should fetch and display orchestras', async () => {
    const mockOrchestras = [
      {
        id: '1',
        name: 'Test Orchestra',
        repositoryPath: '/test/path',
        status: 'ACTIVE',
        createdAt: '2024-01-01T00:00:00Z',
        agents: [{ id: 'a1', name: 'Agent 1' }],
        backlogItems: [{ id: 'b1', title: 'Task 1' }],
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockOrchestras }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Test Orchestra')).toBeInTheDocument();
    });

    expect(screen.getByText('/test/path')).toBeInTheDocument();
    expect(screen.getByText('1 agents')).toBeInTheDocument();
    expect(screen.getByText('1 tasks')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('should display empty state when no orchestras exist', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText(/no orchestras yet/i)).toBeInTheDocument();
    });
  });

  it('should open create modal when New Orchestra button is clicked', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    const user = userEvent.setup();
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText(/no orchestras yet/i)).toBeInTheDocument();
    });

    const newButton = screen.getByRole('button', { name: /new orchestra/i });
    await user.click(newButton);

    expect(screen.getByText(/create new orchestra/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/my project orchestra/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/\/users\/username\/projects\/my-app/i)).toBeInTheDocument();
  });

  it('should handle fetch error gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText(/no orchestras yet/i)).toBeInTheDocument();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch orchestras:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
