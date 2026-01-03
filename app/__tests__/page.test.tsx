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

    expect(screen.getByRole('heading', { name: /^orchestra$/i })).toBeInTheDocument();
  });

  it('should fetch and display orchestras', async () => {
    const mockOrchestras = [
      {
        id: '1',
        name: 'Test Orchestra',
        repositoryPath: '/test/path',
        wipLimit: 2,
        status: 'ACTIVE',
        createdAt: '2024-01-01T00:00:00Z',
        agents: [{ id: 'a1', name: 'Agent 1' }],
        backlogItems: [
          { id: 'b1', content: 'Task 1', status: 'QUEUED' },
          { id: 'b2', content: 'Task 2', status: 'IN_PROGRESS' },
        ],
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
    expect(screen.getByText('2 queued')).toBeInTheDocument();
    expect(screen.getByText('WIP: 1/2')).toBeInTheDocument();
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

    // Modal heading should be visible
    expect(screen.getByRole('heading', { name: /^new orchestra$/i })).toBeInTheDocument();
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

  it('should delete orchestra when delete button is clicked and confirmed', async () => {
    const mockOrchestras = [
      {
        id: '1',
        name: 'Test Orchestra',
        repositoryPath: '/test/path',
        wipLimit: 2,
        status: 'ACTIVE',
        createdAt: '2024-01-01T00:00:00Z',
        agents: [],
        backlogItems: [],
      },
    ];

    // Mock window.confirm
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    // Initial fetch returns orchestra
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockOrchestras }),
    });

    const user = userEvent.setup();
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Test Orchestra')).toBeInTheDocument();
    });

    // Mock DELETE request
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { deleted: true } }),
    });

    // Mock fetch for refresh after delete (empty list)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    // Find and click delete button
    const deleteButton = screen.getByTitle('Delete orchestra');
    await user.click(deleteButton);

    // Verify confirmation was called
    expect(confirmSpy).toHaveBeenCalledWith(
      'Are you sure you want to delete "Test Orchestra"? This action cannot be undone.'
    );

    // Verify DELETE request was made
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/orchestras/1', {
        method: 'DELETE',
      });
    });

    // Verify list was refreshed
    await waitFor(() => {
      expect(screen.getByText(/no orchestras yet/i)).toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it('should not delete orchestra when user cancels confirmation', async () => {
    const mockOrchestras = [
      {
        id: '1',
        name: 'Test Orchestra',
        repositoryPath: '/test/path',
        wipLimit: 2,
        status: 'ACTIVE',
        createdAt: '2024-01-01T00:00:00Z',
        agents: [],
        backlogItems: [],
      },
    ];

    // Mock window.confirm to return false (user cancels)
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockOrchestras }),
    });

    const user = userEvent.setup();
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Test Orchestra')).toBeInTheDocument();
    });

    const deleteButton = screen.getByTitle('Delete orchestra');
    await user.click(deleteButton);

    // Verify confirmation was called
    expect(confirmSpy).toHaveBeenCalled();

    // Verify DELETE was NOT called (only initial fetch)
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Orchestra should still be visible
    expect(screen.getByText('Test Orchestra')).toBeInTheDocument();

    confirmSpy.mockRestore();
  });
});
