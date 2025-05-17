import { createClient } from '@supabase/supabase-js';
import Dexie from 'dexie';
import Papa from 'papaparse';
import { useState, useEffect } from 'react';

// Inicializar Supabase con credenciales hardcodeadas
const supabase = createClient(
  'https://dgesdafhrxbnapzdgoiy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnZXNkYWZocnhibmFwemRnb2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0MjQ0NzUsImV4cCI6MjA2MzAwMDQ3NX0.S0s4DVfcjHgtOwx80NObSaa1zOLo9jrhbffAWCsLFvE'
);

const db = new Dexie('MediaTrackerDB');
db.version(2).stores({
  users: 'id, email',
  platforms: 'name',
  media: 'id, userId, type',
  seasons: 'id, mediaId',
  episodes: 'id, seasonId',
});

const generateId = () => {
  return 'id_' + Math.random().toString(36).substr(2, 9);
};

const updateLastActivity = () => {
  localStorage.setItem('lastActivity', Date.now());
};

const hasSessionExpired = () => {
  const lastActivity = localStorage.getItem('lastActivity');
  if (!lastActivity) return true;
  const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
  return timeSinceLastActivity > 15 * 60 * 1000; // 15 minutos
};

function App() {
  const [user, setUser] = useState(null);
  const [media, setMedia] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (hasSessionExpired()) {
      localStorage.removeItem('userId');
      localStorage.removeItem('lastActivity');
      setUser(null);
      return;
    }
    if (userId) {
      db.users.get(userId).then((storedUser) => {
        if (storedUser) {
          setUser(storedUser);
          db.media.where({ userId }).toArray().then((userMedia) => setMedia(userMedia));
        }
      });
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('lastActivity');
    setUser(null);
    setMedia([]);
  };

  return (
    <div className="container">
      <h1>Media Tracker (Versión 9.0)</h1>
      {error && <p className="error">{error}</p>}
      {user ? (
        <>
          <p>
            Bienvenido, {user.email} <button onClick={handleLogout}>Cerrar Sesión</button>
          </p>
          <button onClick={() => setShowAddForm(true)}>Agregar Película/Serie</button>
          <Settings user={user} setMedia={setMedia} />
          {showAddForm && <MediaForm user={user} setMedia={setMedia} setShowAddForm={setShowAddForm} />}
          <MediaList media={media} setMedia={setMedia} user={user} />
        </>
      ) : (
        <Auth setUser={setUser} setMedia={setMedia} setError={setError} />
      )}
    </div>
  );
}

function Auth({ setUser, setMedia, setError }) {
  const [showLogin, setShowLogin] = useState(true);

  return showLogin ? (
    <LoginForm setUser={setUser} setMedia={setMedia} setError={setError} setShowLogin={setShowLogin} />
  ) : (
    <RegisterForm setShowLogin={setShowLogin} setError={setError} />
  );
}

function LoginForm({ setUser, setMedia, setError, setShowLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const user = await db.users.where({ email }).first();
      if (!user) {
        await db.users.add({ id: data.user.id, email });
        localStorage.setItem('userId', data.user.id);
        setUser({ id: data.user.id, email });
      } else {
        localStorage.setItem('userId', user.id);
        setUser(user);
        const userMedia = await db.media.where({ userId: user.id }).toArray();
        setMedia(userMedia);
      }
      updateLastActivity();
    } catch (err) {
      setError('Error al iniciar sesión: ' + err.message);
    }
  };

  const handleForgotPassword = async () => {
    setForgotError('');
    setForgotSuccess('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: 'https://streaming-movies.netlify.app/reset-password',
      });
      if (error) throw error;
      setForgotSuccess('Se ha enviado un enlace de restablecimiento a tu correo.');
    } catch (err) {
      setForgotError('Error: ' + err.message);
    }
  };

  return (
    <div className="card">
      <h2>Iniciar Sesión</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input type="submit" value="Iniciar Sesión" />
      </form>
      <p>
        ¿No tienes cuenta? <button onClick={() => setShowLogin(false)}>Regístrate</button>
      </p>
      <p>
        <button onClick={() => setShowForgotPassword(true)}>Olvidé mi contraseña</button>
      </p>

      {/* Ventana pop-up para recuperación de contraseña */}
      <div className="modal" style={{ display: showForgotPassword ? 'block' : 'none' }}>
        <div className="modal-content">
          <h3>Recuperar Contraseña</h3>
          <input
            type="email"
            placeholder="Ingresa tu correo"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            required
          />
          {forgotError && <p className="error">{forgotError}</p>}
          {forgotSuccess && <p style={{ color: 'green' }}>{forgotSuccess}</p>}
          <div className="flex" style={{ marginTop: '10px' }}>
            <button onClick={handleForgotPassword}>Enviar enlace</button>
            <button onClick={() => setShowForgotPassword(false)}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisterForm({ setShowLogin, setError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      const userId = data.user.id;
      await db.users.add({ id: userId, email });
      setShowLogin(true);
    } catch (err) {
      setError('Error al registrarse: ' + err.message);
    }
  };

  return (
    <div className="card">
      <h2>Registrarse</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input type="submit" value="Registrarse" />
      </form>
      <p>
        ¿Ya tienes cuenta? <button onClick={() => setShowLogin(true)}>Inicia Sesión</button>
      </p>
    </div>
  );
}

function Settings({ user, setMedia }) {
  const [showSettings, setShowSettings] = useState(false);

  const exportToCSV = async () => {
    const tables = ['users', 'platforms', 'media', 'seasons', 'episodes'];
    for (const table of tables) {
      const data = await db[table].toArray();
      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${table}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const importFromCSV = async (event, table) => {
    const file = event.target.files[0];
    Papa.parse(file, {
      header: true,
      complete: async (result) => {
        const data = result.data;
        await db[table].clear();
        await db[table].bulkAdd(data);
        if (table === 'media') {
          const userMedia = await db.media.where({ userId: user.id }).toArray();
          setMedia(userMedia);
        }
      },
    });
  };

  return (
    <div>
      <button onClick={() => setShowSettings(true)}>Configuración</button>
      <div className="modal" style={{ display: showSettings ? 'block' : 'none' }}>
        <div className="modal-content">
          <h3>Configuración</h3>
          <button onClick={exportToCSV}>Exportar a CSV</button>
          <div style={{ marginTop: '10px' }}>
            <h4>Importar Datos</h4>
            {['users', 'platforms', 'media', 'seasons', 'episodes'].map((table) => (
              <div key={table}>
                <label>{table.charAt(0).toUpperCase() + table.slice(1)}:</label>
                <input type="file" accept=".csv" onChange={(e) => importFromCSV(e, table)} />
              </div>
            ))}
          </div>
          <button onClick={() => setShowSettings(false)} style={{ marginTop: '10px' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function MediaForm({ user, setMedia, setShowAddForm }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('película');
  const [platform, setPlatform] = useState('');
  const [genre, setGenre] = useState('');
  const [customGenre, setCustomGenre] = useState('');
  const [duration, setDuration] = useState('');
  const [status, setStatus] = useState('por ver');
  const [rating, setRating] = useState('');
  const [seasons, setSeasons] = useState([]);
  const [availablePlatforms, setAvailablePlatforms] = useState([]);
  const [editingMedia, setEditingMedia] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    db.platforms.toArray().then((plats) => {
      setAvailablePlatforms(plats.map((p) => p.name).sort());
    });
  }, []);

  useEffect(() => {
    console.log('Iniciando carga de temporadas - isEditing:', isEditing, 'type:', type);
    if (isEditing && type === 'serie') {
      const loadSeasons = async () => {
        try {
          const mediaSeasons = await db.seasons.where({ mediaId: editingMedia.id }).toArray();
          const seasonsWithEpisodes = await Promise.all(
            mediaSeasons.map(async (s) => {
              const episodes = await db.episodes.where({ seasonId: s.id }).toArray();
              return {
                id: s.id,
                seasonNumber: s.seasonNumber,
                episodeCount: s.episodeCount,
                episodes: episodes.map((e) => ({
                  id: e.id,
                  episodeNumber: e.episodeNumber,
                  duration: e.duration,
                  watched: e.watched,
                })),
              };
            })
          );
          setSeasons(seasonsWithEpisodes);
          console.log('Temporadas cargadas para edición:', seasonsWithEpisodes);
        } catch (err) {
          setFormError('Error al cargar temporadas para edición: ' + err.message);
          console.error('Error al cargar temporadas:', err);
        }
      };
      loadSeasons();
    } else {
      setSeasons([]);
      console.log('No se cargan temporadas - isEditing:', isEditing, 'type:', type);
    }
  }, [editingMedia, type]);

  const handleAddSeason = () => {
    const newSeason = {
      seasonNumber: seasons.length + 1,
      episodeCount: 1,
      episodes: [{ episodeNumber: 1, duration: 0, watched: false }],
    };
    setSeasons([...seasons, newSeason]);
    console.log('Temporada añadida en MediaForm:', newSeason);
    console.log('Estado seasons actualizado:', [...seasons, newSeason]);
  };

  const handleEpisodeCountChange = (seasonIndex, episodeCount) => {
    const updatedSeasons = [...seasons];
    updatedSeasons[seasonIndex].episodeCount = parseInt(episodeCount);
    updatedSeasons[seasonIndex].episodes = Array.from({ length: episodeCount }, (_, i) => ({
      episodeNumber: i + 1,
      duration: updatedSeasons[seasonIndex].episodes[i]?.duration || 0,
      watched: updatedSeasons[seasonIndex].episodes[i]?.watched || false,
    }));
    setSeasons(updatedSeasons);
  };

  const handleEpisodeDurationChange = (seasonIndex, episodeIndex, duration) => {
    const updatedSeasons = [...seasons];
    updatedSeasons[seasonIndex].episodes[episodeIndex].duration = parseInt(duration) || 0;
    setSeasons(updatedSeasons);
  };

  const handleEpisodeWatchedChange = (seasonIndex, episodeIndex, watched) => {
    const updatedSeasons = [...seasons];
    updatedSeasons[seasonIndex].episodes[episodeIndex].watched = watched;
    setSeasons(updatedSeasons);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log(isEditing ? 'Editando medio:' : 'Agregando medio:', title);
    console.log('Plataforma ingresada:', platform);

    if (hasSessionExpired()) {
      console.log('Sesión expirada al intentar guardar medio');
      localStorage.removeItem('userId');
      localStorage.removeItem('lastActivity');
      setFormError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
      return;
    }

    if (status === 'visto' && !rating) {
      setFormError('El rating es obligatorio cuando el estado es "visto".');
      console.log('Error: Rating requerido para estado "visto"');
      return;
    }

    if (!platform) {
      setFormError('El campo Plataforma es obligatorio.');
      console.log('Error: Plataforma requerida');
      return;
    }

    try {
      const trimmedPlatform = platform.trim();
      const platformExists = await db.platforms.where({ name: trimmedPlatform }).first();
      if (!platformExists) {
        await db.platforms.add({ name: trimmedPlatform });
        console.log('Nueva plataforma añadida:', trimmedPlatform);
        setAvailablePlatforms([...availablePlatforms, trimmedPlatform].sort());
      }

      const finalGenre = genre === 'Otro' ? customGenre : genre;
      const mediaId = isEditing ? editingMedia.id : generateId();

      if (isEditing) {
        console.log('Actualizando medio en IndexedDB:', { id: mediaId, platform });
        await db.media.update(mediaId, {
          title,
          type,
          platform: trimmedPlatform,
          genre: finalGenre,
          duration: parseInt(duration) || 0,
          status,
          rating: rating ? parseInt(rating) : null,
        });

        if (type === 'serie') {
          const existingSeasons = await db.seasons.where({ mediaId }).toArray();
          for (const season of existingSeasons) {
            await db.episodes.where({ seasonId: season.id }).delete();
            await db.seasons.delete(season.id);
          }

          for (const season of seasons) {
            const seasonId = season.id || generateId();
            const totalDuration = season.episodes.reduce((sum, ep) => sum + (ep.duration || 0), 0);
            console.log('Guardando temporada (edición):', {
              seasonId,
              mediaId,
              seasonNumber: season.seasonNumber,
              episodeCount: season.episodeCount,
              totalDuration,
            });
            await db.seasons.add({
              id: seasonId,
              mediaId,
              seasonNumber: season.seasonNumber,
              episodeCount: season.episodeCount,
              totalDuration,
            });

            for (const episode of season.episodes) {
              const episodeId = episode.id || generateId();
              console.log('Guardando episodio (edición):', {
                episodeId,
                seasonId,
                episodeNumber: episode.episodeNumber,
                duration: episode.duration,
                watched: episode.watched,
              });
              await db.episodes.add({
                id: episodeId,
                seasonId,
                episodeNumber: episode.episodeNumber,
                duration: episode.duration || 0,
                watched: episode.watched,
              });
            }
          }
        }
      } else {
        console.log('Guardando nuevo medio en IndexedDB:', { id: mediaId, platform });
        await db.media.add({
          id: mediaId,
          userId: user.id,
          title,
          type,
          platform: trimmedPlatform,
          genre: finalGenre,
          duration: parseInt(duration) || 0,
          status,
          rating: rating ? parseInt(rating) : null,
        });

        if (type === 'serie') {
          for (const season of seasons) {
            const seasonId = generateId();
            const totalDuration = season.episodes.reduce((sum, ep) => sum + (ep.duration || 0), 0);
            console.log('Guardando temporada:', {
              seasonId,
              mediaId,
              seasonNumber: season.seasonNumber,
              episodeCount: season.episodeCount,
              totalDuration,
            });
            await db.seasons.add({
              id: seasonId,
              mediaId,
              seasonNumber: season.seasonNumber,
              episodeCount: season.episodeCount,
              totalDuration,
            });

            for (const episode of season.episodes) {
              const episodeId = generateId();
              console.log('Guardando episodio:', {
                episodeId,
                seasonId,
                episodeNumber: episode.episodeNumber,
                duration: episode.duration,
                watched: episode.watched,
              });
              await db.episodes.add({
                id: episodeId,
                seasonId,
                episodeNumber: episode.episodeNumber,
                duration: episode.duration || 0,
                watched: episode.watched,
              });
            }
          }
        }
      }

      const userMedia = await db.media.where({ userId: user.id }).toArray();
      console.log('Medios recargados después de guardar:', userMedia);
      setMedia(userMedia);

      setTitle('');
      setType('película');
      setPlatform('');
      setGenre('');
      setDuration('');
      setStatus('por ver');
      setRating('');
      setSeasons([]);
      setCustomGenre('');
      setEditingMedia(null);
      setIsEditing(false);
      setShowAddForm(false);
      setFormError('');
      console.log(isEditing ? 'Medio actualizado:' : 'Medio añadido:', { id: mediaId, title, platform });
      updateLastActivity();
    } catch (err) {
      setFormError((isEditing ? 'Error al editar medio: ' + err.message : 'Error al agregar medio: ' + err.message));
      console.error('Error:', err);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>{isEditing ? 'Editar' : 'Agregar'} Película/Serie</h3>
        {formError && <p className="error">{formError}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="película">Película</option>
            <option value="serie">Serie</option>
          </select>
          <input
            type="text"
            placeholder="Plataforma"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            list="platforms"
            required
          />
          <datalist id="platforms">
            {availablePlatforms.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="">Selecciona un género</option>
            <option value="Acción">Acción</option>
            <option value="Drama">Drama</option>
            <option value="Comedia">Comedia</option>
            <option value="Terror">Terror</option>
            <option value="Ciencia ficción">Ciencia ficción</option>
            <option value="Otro">Otro</option>
          </select>
          {genre === 'Otro' && (
            <input
              type="text"
              placeholder="Especifica el género"
              value={customGenre}
              onChange={(e) => setCustomGenre(e.target.value)}
            />
          )}
          <input
            type="number"
            placeholder="Duración (min)"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            disabled={type === 'serie'}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="por ver">Por ver</option>
            <option value="viendo">Viendo</option>
            <option value="visto">Visto</option>
          </select>
          {status === 'visto' && (
            <select value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="">Selecciona un rating</option>
              {[...Array(10)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          )}
          {type === 'serie' && (
            <div>
              <h4>Temporadas</h4>
              <button type="button" onClick={handleAddSeason}>
                Agregar Temporada
              </button>
              {seasons.map((season, seasonIndex) => (
                <div key={season.seasonNumber} style={{ marginTop: '10px' }}>
                  <p>Temporada {season.seasonNumber}</p>
                  <label>Cantidad de episodios:</label>
                  <input
                    type="number"
                    min="1"
                    value={season.episodeCount}
                    onChange={(e) => handleEpisodeCountChange(seasonIndex, e.target.value)}
                  />
                  {season.episodes.map((episode, episodeIndex) => (
                    <div key={episode.episodeNumber} className="flex" style={{ marginTop: '5px' }}>
                      <span>Episodio {episode.episodeNumber}</span>
                      <input
                        type="number"
                        placeholder="Duración (min)"
                        value={episode.duration}
                        onChange={(e) => handleEpisodeDurationChange(seasonIndex, episodeIndex, e.target.value)}
                      />
                      <label>
                        Visto:
                        <input
                          type="checkbox"
                          checked={episode.watched}
                          onChange={(e) => handleEpisodeWatchedChange(seasonIndex, episodeIndex, e.target.checked)}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="flex" style={{ marginTop: '10px' }}>
            <input type="submit" value={isEditing ? 'Actualizar' : 'Agregar'} />
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setEditingMedia(null);
                setIsEditing(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MediaList({ media, setMedia, user }) {
  const [filterType, setFilterType] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [availablePlatforms, setAvailablePlatforms] = useState([]);
  const [availableGenres, setAvailableGenres] = useState([]);

  useEffect(() => {
    db.platforms.toArray().then((plats) => {
      setAvailablePlatforms(plats.map((p) => p.name).sort());
    });
    const genres = [...new Set(media.map((m) => m.genre))].filter((g) => g).sort();
    setAvailableGenres(genres);
  }, [media]);

  const filteredMedia = media.filter((m) => {
    return (
      (!filterType || m.type === filterType) &&
      (!filterPlatform || m.platform === filterPlatform) &&
      (!filterGenre || m.genre === filterGenre) &&
      (!filterStatus || m.status === filterStatus)
    );
  });

  const handleEdit = (mediaItem) => {
    const form = document.createElement('div');
    ReactDOM.render(
      <MediaForm
        user={user}
        setMedia={setMedia}
        setShowAddForm={() => ReactDOM.unmountComponentAtNode(form)}
        editingMedia={mediaItem}
        isEditing={true}
      />,
      form
    );
  };

  const handleDelete = async (mediaId) => {
    if (hasSessionExpired()) {
      localStorage.removeItem('userId');
      localStorage.removeItem('lastActivity');
      alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
      return;
    }

    await db.media.delete(mediaId);
    const seasons = await db.seasons.where({ mediaId }).toArray();
    for (const season of seasons) {
      await db.episodes.where({ seasonId: season.id }).delete();
      await db.seasons.delete(season.id);
    }
    const userMedia = await db.media.where({ userId: user.id }).toArray();
    setMedia(userMedia);
    updateLastActivity();
  };

  return (
    <div>
      <h2>Lista de Medios</h2>
      <div className="flex">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="película">Película</option>
          <option value="serie">Serie</option>
        </select>
        <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)}>
          <option value="">Todas las plataformas</option>
          {availablePlatforms.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={filterGenre} onChange={(e) => setFilterGenre(e.target.value)}>
          <option value="">Todos los géneros</option>
          {availableGenres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="por ver">Por ver</option>
          <option value="viendo">Viendo</option>
          <option value="visto">Visto</option>
        </select>
      </div>
      {filteredMedia.map((m) => (
        <div key={m.id} className="card">
          <h3>
            {m.title} ({m.type.charAt(0).toUpperCase() + m.type.slice(1)})
          </h3>
          <p>Plataforma: {m.platform}</p>
          <p>Género: {m.genre || 'No especificado'}</p>
          {m.type === 'película' && <p>Duración: {m.duration} min</p>}
          <p>Estado: {m.status.charAt(0).toUpperCase() + m.status.slice(1)}</p>
          {m.status === 'visto' && <p>Rating: {m.rating}/10</p>}
          {m.type === 'serie' && <SeriesDetails mediaId={m.id} />}
          <div className="flex">
            <button onClick={() => handleEdit(m)}>Editar</button>
            <button onClick={() => handleDelete(m.id)} style={{ background: '#dc3545' }}>
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SeriesDetails({ mediaId }) {
  const [seasons, setSeasons] = useState([]);

  const fetchSeasons = async () => {
    console.log('Cargando temporadas para medio:', mediaId);
    try {
      const seasonsData = await db.seasons.where({ mediaId }).toArray();
      console.log('Temporadas encontradas:', seasonsData);
      const seasonsWithEpisodes = await Promise.all(
        seasonsData.map(async (s) => {
          const episodes = await db.episodes.where({ seasonId: s.id }).toArray();
          console.log(`Episodios para temporada ${s.id}:`, episodes);
          return { ...s, episodes, completed: episodes.every((e) => e.watched) };
        })
      );
      setSeasons(seasonsWithEpisodes);
      console.log('Temporadas cargadas con episodios:', seasonsWithEpisodes);
    } catch (err) {
      console.error('Error al cargar temporadas:', err);
    }
  };

  useEffect(() => {
    fetchSeasons();
  }, [mediaId]);

  useEffect(() => {
    if (seasons.length === 0) {
      console.log('seasons está vacío, intentando recargar datos...');
      fetchSeasons();
    }
  }, [seasons]);

  const handleEpisodeToggle = async (episodeId, watched) => {
    if (hasSessionExpired()) {
      localStorage.removeItem('userId');
      localStorage.removeItem('lastActivity');
      alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
      return;
    }

    await db.episodes.update(episodeId, { watched });
    fetchSeasons();
    updateLastActivity();
  };

  console.log('Renderizando SeriesDetails - seasons:', seasons);

  return (
    <div style={{ marginTop: '20px' }}>
      <h4 style={{ fontWeight: 'bold' }}>Temporadas</h4>
      {seasons.length > 0 ? (
        seasons.map((s) => (
          <div key={s.id} style={{ marginTop: '10px' }}>
            <p>
              Temporada {s.seasonNumber} {s.completed ? '(Completada)' : ''}
            </p>
            {s.episodes.map((e) => (
              <div key={e.id} className="flex" style={{ marginTop: '5px' }}>
                <input
                  type="checkbox"
                  checked={e.watched}
                  onChange={() => handleEpisodeToggle(e.id, !e.watched)}
                />
                <span>
                  Episodio {e.episodeNumber} ({e.duration} min)
                </span>
              </div>
            ))}
          </div>
        ))
      ) : (
        <p style={{ color: '#666' }}>No hay temporadas registradas.</p>
      )}
    </div>
  );
}

export default App;
