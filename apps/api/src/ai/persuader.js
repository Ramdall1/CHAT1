/**
 * Sistema de persuasión emocional para la IA de ventas
 * Genera mensajes persuasivos basados en el contexto del usuario
 */

export class Persuader {
  constructor() {
    this.mensajesPersuasivos = {
      inicial: [
        '¡Qué alegría que quieras participar! 🌟 Esta actividad tiene un premio total de $4.000.000 COP 💰',
        '¡Excelente decisión! 🎉 Te vas a emocionar con esta oportunidad única de ganar $4.000.000 COP 💸',
        '¡Me encanta tu entusiasmo! ✨ Esta es tu oportunidad de cambiar tu vida con $4.000.000 COP 🙌',
      ],

      precio: [
        'Cada número cuesta solo $1.000 COP y tiene 4 dígitos. ¡Es una inversión mínima para una oportunidad máxima! 💎',
        'Por solo $1.000 COP tienes la posibilidad de ganar $4.000.000 COP. ¡Es como comprar un café pero con la chance de ser millonario! ☕💰',
        'Imagínate: $1.000 COP por número y puedes llevarte $4.000.000 COP. ¡Es la mejor inversión que puedes hacer hoy! 🚀',
      ],

      seguridad: [
        'Puedes estar 100% tranquilo/a. Somos una empresa seria y transparente. Miles de personas ya han participado con nosotros 🛡️',
        'Tu dinero está completamente seguro. Tenemos años de experiencia y cientos de ganadores felices 🏆',
        'Trabajamos con total transparencia. Puedes verificar todo nuestro historial de ganadores y testimonios reales ✅',
      ],

      urgencia: [
        'Los números se están agotando rápidamente. No te quedes sin tu oportunidad de ser millonario/a 🏃‍♂️💨',
        'Quedan pocos números disponibles. ¡Asegura el tuyo antes de que sea demasiado tarde! ⏰',
        'Esta oportunidad no durará para siempre. Los números más bendecidos se van primero 🍀',
      ],

      emocional: [
        'Imagínate llamando a tu familia para contarles que ganaste $4.000.000 COP. ¡Esa alegría no tiene precio! 📞❤️',
        'Piensa en todo lo que podrías hacer con $4.000.000 COP: ayudar a tu familia, cumplir tus sueños, cambiar tu vida 🌈',
        'Este podría ser el momento que cambie tu historia. $4.000.000 COP pueden transformar tu futuro 🌟',
      ],

      confianza: [
        'Miles de personas como tú ya han confiado en nosotros y han cambiado sus vidas 👥💫',
        'Tenemos ganadores reales, con nombres y testimonios verificables. ¡Tú podrías ser el próximo! 🏆',
        'Nuestra reputación habla por sí sola. Años ayudando a personas a cumplir sus sueños 💝',
      ],
    };

    this.mensajesFormulario = [
      'Te enviaré ahora un pequeño formulario para registrar tus datos y asegurarte tus números bendecidos 🙏✨',
      'Perfecto 🙌 Te enviaré un formulario rápido para confirmar tus datos y cantidad de números. ¡Solo te tomará unos segundos!',
      'Genial 🙌 Me alegra que quieras participar. Te enviaré un formulario rápido para registrar tu nombre, ciudad y cantidad de números.',
      '¡Excelente! 🎉 Te voy a enviar un formulario súper fácil para que reserves tus números de la suerte 🍀',
    ];

    this.mensajesAgradecimiento = {
      base: 'Gracias {nombre} 🙏 Ya registré tus datos correctamente.',
      numeros:
        'Tienes {cantidad} números de 4 dígitos por solo $1.000 COP c/u.',
      premio: '¡El premio es de $4.000.000! 💰',
      siguiente:
        '¿Quieres que te envíe el link o número de Nequi para completar tu compra?',
    };
  }

  /**
   * Genera un mensaje persuasivo basado en el contexto del usuario
   */
  generarMensajePersuasivo(contexto) {
    try {
      const { interes, pregunta, nivelEngagement, historial } = contexto;

      let mensaje = '';
      const categoria = this.determinarCategoria(pregunta, interes, historial);

      // Seleccionar mensaje base según la categoría
      const mensajesCategoria =
        this.mensajesPersuasivos[categoria] || this.mensajesPersuasivos.inicial;
      const mensajeBase = this.seleccionarMensajeAleatorio(mensajesCategoria);

      mensaje += mensajeBase;

      // Agregar elementos adicionales según el contexto
      if (this.necesitaInformacionPrecio(pregunta)) {
        mensaje +=
          '\n\n' +
          this.seleccionarMensajeAleatorio(this.mensajesPersuasivos.precio);
      }

      if (this.necesitaInformacionSeguridad(pregunta)) {
        mensaje +=
          '\n\n' +
          this.seleccionarMensajeAleatorio(this.mensajesPersuasivos.seguridad);
      }

      if (nivelEngagement === 'alto' && !this.yaEnvioUrgencia(historial)) {
        mensaje +=
          '\n\n' +
          this.seleccionarMensajeAleatorio(this.mensajesPersuasivos.urgencia);
      }

      // Agregar elemento emocional si es apropiado
      if (this.debeAgregarElementoEmocional(contexto)) {
        mensaje +=
          '\n\n' +
          this.seleccionarMensajeAleatorio(this.mensajesPersuasivos.emocional);
      }

      return mensaje;
    } catch (error) {
      console.error('❌ Error generando mensaje persuasivo:', error);
      return this.seleccionarMensajeAleatorio(this.mensajesPersuasivos.inicial);
    }
  }

  /**
   * Genera mensaje para acompañar el envío del formulario
   */
  generarMensajeFormulario() {
    return this.seleccionarMensajeAleatorio(this.mensajesFormulario);
  }

  /**
   * Genera mensaje de agradecimiento personalizado
   */
  generarMensajeAgradecimiento(datos) {
    try {
      const { nombre, cantidad, ciudad, metodo_pago } = datos;

      let mensaje = this.mensajesAgradecimiento.base.replace(
        '{nombre}',
        nombre || 'amigo/a'
      );
      mensaje +=
        '\n' +
        this.mensajesAgradecimiento.numeros.replace(
          '{cantidad}',
          cantidad || '1'
        );
      mensaje += '\n' + this.mensajesAgradecimiento.premio;

      // Personalizar según método de pago
      if (metodo_pago === 'Nequi') {
        mensaje +=
          '\n' +
          '¿Quieres que te envíe el número de Nequi para completar tu compra? 📱💳';
      } else if (metodo_pago === 'Transferencia') {
        mensaje +=
          '\n' +
          '¿Quieres que te envíe los datos bancarios para hacer la transferencia? 🏦💸';
      } else {
        mensaje += '\n' + this.mensajesAgradecimiento.siguiente;
      }

      // Agregar mensaje motivacional final
      const mensajesFinales = [
        '¡Estás a un paso de cambiar tu vida! 🌟',
        '¡Tu número de la suerte te está esperando! 🍀',
        '¡El destino te sonríe hoy! ✨',
        '¡Siento que vas a ser el próximo ganador! 🏆',
      ];

      mensaje += '\n\n' + this.seleccionarMensajeAleatorio(mensajesFinales);

      return mensaje;
    } catch (error) {
      console.error('❌ Error generando mensaje de agradecimiento:', error);
      return 'Gracias por participar 🙏 Ya registré tus datos correctamente. ¡El premio es de $4.000.000! 💰';
    }
  }

  /**
   * Determina la categoría del mensaje según el contexto
   */
  determinarCategoria(pregunta, interes, historial) {
    const preguntaLower = pregunta.toLowerCase();

    if (
      preguntaLower.includes('precio') ||
      preguntaLower.includes('cuesta') ||
      preguntaLower.includes('vale')
    ) {
      return 'precio';
    }

    if (
      preguntaLower.includes('segur') ||
      preguntaLower.includes('confia') ||
      preguntaLower.includes('estafa')
    ) {
      return 'seguridad';
    }

    if (
      preguntaLower.includes('tiempo') ||
      preguntaLower.includes('cuando') ||
      preguntaLower.includes('rapido')
    ) {
      return 'urgencia';
    }

    if (this.tieneAltaIntencionCompra(pregunta)) {
      return 'emocional';
    }

    return 'inicial';
  }

  /**
   * Verifica si necesita información de precio
   */
  necesitaInformacionPrecio(pregunta) {
    const palabrasClave = [
      'precio',
      'cuesta',
      'vale',
      'dinero',
      'pago',
      'costo',
    ];
    return palabrasClave.some(palabra =>
      pregunta.toLowerCase().includes(palabra)
    );
  }

  /**
   * Verifica si necesita información de seguridad
   */
  necesitaInformacionSeguridad(pregunta) {
    const palabrasClave = [
      'segur',
      'confia',
      'estafa',
      'real',
      'verdad',
      'legitim',
    ];
    return palabrasClave.some(palabra =>
      pregunta.toLowerCase().includes(palabra)
    );
  }

  /**
   * Verifica si ya se envió mensaje de urgencia
   */
  yaEnvioUrgencia(historial) {
    if (!historial || !Array.isArray(historial)) return false;

    return historial.some(
      msg =>
        msg.from === 'BOT' &&
        msg.text &&
        (msg.text.includes('agotando') ||
          msg.text.includes('quedan pocos') ||
          msg.text.includes('no durará'))
    );
  }

  /**
   * Determina si debe agregar elemento emocional
   */
  debeAgregarElementoEmocional(contexto) {
    const { nivelEngagement, historial } = contexto;

    // Agregar elemento emocional si el engagement es alto y no se ha usado mucho
    if (nivelEngagement === 'alto') {
      const mensajesEmocionales = historial.filter(
        msg =>
          msg.from === 'BOT' &&
          msg.text &&
          (msg.text.includes('imagínate') ||
            msg.text.includes('piensa en') ||
            msg.text.includes('cambiar tu vida'))
      );

      return mensajesEmocionales.length < 2;
    }

    return false;
  }

  /**
   * Verifica si hay alta intención de compra
   */
  tieneAltaIntencionCompra(pregunta) {
    const frasesAltas = [
      'quiero participar',
      'quiero comprar',
      'me interesa',
      'como participo',
      'mándame la info',
      'necesito el link',
    ];

    return frasesAltas.some(frase => pregunta.toLowerCase().includes(frase));
  }

  /**
   * Selecciona un mensaje aleatorio de un array
   */
  seleccionarMensajeAleatorio(mensajes) {
    if (!Array.isArray(mensajes) || mensajes.length === 0) {
      return '¡Gracias por tu interés! 😊';
    }

    const indice = Math.floor(Math.random() * mensajes.length);
    return mensajes[indice];
  }

  /**
   * Genera respuesta para preguntas frecuentes con tono persuasivo
   */
  responderPreguntaFrecuente(pregunta) {
    const preguntaLower = pregunta.toLowerCase();

    // Preguntas sobre el premio
    if (preguntaLower.includes('premio') || preguntaLower.includes('gana')) {
      return '¡El premio es increíble! 🤩 Son $4.000.000 COP completos para el ganador. Imagínate todo lo que podrías hacer con esa cantidad: ayudar a tu familia, cumplir tus sueños, cambiar tu vida completamente 🌟💰';
    }

    // Preguntas sobre cómo funciona
    if (
      preguntaLower.includes('funciona') ||
      preguntaLower.includes('como es')
    ) {
      return 'Es súper fácil y emocionante 🎯 Compras números de 4 dígitos por solo $1.000 COP cada uno. Cuando salga el número ganador, ¡podrías ser tú el afortunado con $4.000.000 COP! 🍀 Miles de personas ya han participado y tenemos ganadores reales 🏆';
    }

    // Preguntas sobre confiabilidad
    if (
      preguntaLower.includes('confia') ||
      preguntaLower.includes('segur') ||
      preguntaLower.includes('real')
    ) {
      return 'Puedes estar 100% tranquilo/a 🛡️ Somos una empresa seria con años de experiencia. Tenemos cientos de testimonios reales y ganadores verificables. Tu dinero está completamente seguro y trabajamos con total transparencia ✅💝';
    }

    // Preguntas sobre el sorteo
    if (
      preguntaLower.includes('sorteo') ||
      preguntaLower.includes('cuando') ||
      preguntaLower.includes('fecha')
    ) {
      return '¡El sorteo es muy pronto! 📅 No te quedes sin tu oportunidad porque los números se están agotando rápidamente. Cada día que pasa es una oportunidad menos de cambiar tu vida con $4.000.000 COP 🏃‍♂️💨';
    }

    return null; // No es una pregunta frecuente reconocida
  }
}
