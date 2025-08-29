import './notFound.scss'
//https://giphy.com/gifs/iranserver-iran-server-bluebot-blue-bot-aYpmlCXgX9dc09dbpl
const NotFound = () => {
  return (
    <div className="not-found">
      <div className="not-found-content">
        <img
          src="https://media.giphy.com/media/aYpmlCXgX9dc09dbpl/giphy.gif?cid=ecf05e479v9s7n803dx5x94ju0p9vnt2d2r240ski2ht9js8&ep=v1_gifs_search&rid=giphy.gif&ct=g" // Здесь можно использовать любую забавную картинку
          alt="Not Found"
          className="not-found-image"
        />
        <h1 className="not-found-title">
          Ой! Страница не найдена, кажется вы заблудились.
        </h1>
        <p className="not-found-description">
          Кажется, вы пришли не туда. Может быть, стоит вернуться на главную
          страницу?
        </p>
        <a href="/" className="not-found-link">
          Вернуться на главную
        </a>
      </div>
    </div>
  )
}

export default NotFound
